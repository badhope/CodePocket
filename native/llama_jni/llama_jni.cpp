#include <android/log.h>
#include <jni.h>
#include <llama.h>

#include <mutex>
#include <string>
#include <vector>

#define LOG_TAG "CodePocketLlama"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static llama_model *g_model = nullptr;
static llama_context *g_ctx = nullptr;
static llama_sampler *g_sampler = nullptr;
static int g_n_ctx = 2048;
static std::mutex g_lock;

static void release_all() {
    if (g_sampler) {
        llama_sampler_free(g_sampler);
        g_sampler = nullptr;
    }
    if (g_ctx) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
}

static std::string apply_template(const std::string &system, const std::string &user) {
    const char *tmpl = llama_model_chat_template(g_model, nullptr);
    if (tmpl == nullptr) {
        return system + "\n\n" + user + "\n";
    }
    llama_chat_message messages[2] = {
        {"system", system.c_str()},
        {"user", user.c_str()},
    };
    int32_t needed = llama_chat_apply_template(tmpl, messages, 2, true, nullptr, 0);
    if (needed <= 0) {
        return system + "\n\n" + user + "\n";
    }
    std::vector<char> buffer(static_cast<size_t>(needed) + 1);
    int32_t written = llama_chat_apply_template(
        tmpl, messages, 2, true, buffer.data(), static_cast<int32_t>(buffer.size()));
    if (written <= 0) {
        return system + "\n\n" + user + "\n";
    }
    return std::string(buffer.data(), static_cast<size_t>(written));
}

static std::vector<llama_token> tokenize(const std::string &text) {
    const llama_vocab *vocab = llama_model_get_vocab(g_model);
    int32_t count = llama_tokenize(vocab, text.c_str(), static_cast<int32_t>(text.size()),
                                   nullptr, 0, false, true);
    if (count <= 0) return {};
    std::vector<llama_token> tokens(static_cast<size_t>(count));
    int32_t actual = llama_tokenize(vocab, text.c_str(), static_cast<int32_t>(text.size()),
                                    tokens.data(), count, false, true);
    if (actual <= 0) return {};
    tokens.resize(static_cast<size_t>(actual));
    return tokens;
}

static std::string fit_prompt(const std::string &system, const std::string &user, size_t maxPromptTokens) {
    std::string current = user;
    for (int attempt = 0; attempt < 16; ++attempt) {
        std::string prompt = apply_template(system, current);
        auto tokens = tokenize(prompt);
        if (tokens.size() <= maxPromptTokens) return prompt;
        if (current.empty()) break;
        // 按完整行丢弃最旧的历史，保留 system 和最近观察，避免从 UTF-8 中间截断。
        size_t cut = current.size() / 6;
        if (cut == 0) cut = 1;
        size_t newline = current.find('\n', cut);
        if (newline == std::string::npos) {
            current.clear();
        } else {
            current.erase(0, newline + 1);
        }
    }
    return apply_template(system, current);
}

extern "C"
JNIEXPORT jboolean JNICALL
Java_com_devterminal_model_LocalLlama_nativeInit(JNIEnv *, jobject) {
    llama_backend_init();
    return JNI_TRUE;
}

extern "C"
JNIEXPORT jboolean JNICALL
Java_com_devterminal_model_LocalLlama_nativeLoadModel(
        JNIEnv *env, jobject, jstring jpath, jint nCtx, jint nThreads) {
    std::lock_guard<std::mutex> guard(g_lock);
    release_all();

    const char *path = env->GetStringUTFChars(jpath, nullptr);
    std::string modelPath(path ? path : "");
    env->ReleaseStringUTFChars(jpath, path);
    llama_model_params mparams = llama_model_default_params();
    mparams.n_gpu_layers = 0;
    mparams.load_mode = LLAMA_LOAD_MODE_MMAP;
    g_model = llama_model_load_from_file(modelPath.c_str(), mparams);
    if (g_model == nullptr) {
        LOGE("load model failed: %s", modelPath.c_str());
        return JNI_FALSE;
    }

    llama_context_params cparams = llama_context_default_params();
    g_n_ctx = nCtx > 512 ? nCtx : 2048;
    cparams.n_ctx = static_cast<uint32_t>(g_n_ctx);
    cparams.n_batch = 512;
    cparams.n_ubatch = 512;
    cparams.n_threads = nThreads > 0 ? nThreads : 4;
    cparams.n_threads_batch = cparams.n_threads;
    g_ctx = llama_init_from_model(g_model, cparams);
    if (g_ctx == nullptr) {
        LOGE("create context failed");
        release_all();
        return JNI_FALSE;
    }
    g_sampler = llama_sampler_init_greedy();
    LOGI("model loaded, n_ctx=%d, threads=%d", g_n_ctx, cparams.n_threads);
    return JNI_TRUE;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_devterminal_model_LocalLlama_nativeGenerate(
        JNIEnv *env, jobject, jstring jsystem, jstring juser, jint maxTokens) {
    std::lock_guard<std::mutex> guard(g_lock);
    if (g_model == nullptr || g_ctx == nullptr || g_sampler == nullptr) {
        return env->NewStringUTF("本地模型尚未加载");
    }
    const char *system = env->GetStringUTFChars(jsystem, nullptr);
    const char *user = env->GetStringUTFChars(juser, nullptr);
    std::string systemText(system);
    std::string userText(user);
    env->ReleaseStringUTFChars(jsystem, system);
    env->ReleaseStringUTFChars(juser, user);

    // 给生成预留 token；绝不能把 system 指令从开头截掉，否则 JSON 协议和工具清单先丢。
    const int limit = maxTokens > 0 ? maxTokens : 512;
    const size_t reserved = static_cast<size_t>(limit) + 32;
    const size_t maxPrompt = static_cast<size_t>(g_n_ctx) > reserved + 512
            ? static_cast<size_t>(g_n_ctx) - reserved
            : 512;
    std::string prompt = fit_prompt(systemText, userText, maxPrompt);
    auto tokens = tokenize(prompt);
    if (tokens.empty()) {
        return env->NewStringUTF("提示词分词失败");
    }

    llama_memory_clear(llama_get_memory(g_ctx), true);
    llama_sampler_reset(g_sampler);

    llama_batch batch = llama_batch_init(static_cast<int32_t>(tokens.size()), 0, 1);
    for (size_t i = 0; i < tokens.size(); i++) {
        batch.token[i] = tokens[i];
        batch.pos[i] = static_cast<llama_pos>(i);
        batch.n_seq_id[i] = 1;
        batch.seq_id[i][0] = 0;
        batch.logits[i] = (i + 1 == tokens.size()) ? 1 : 0;
    }
    batch.n_tokens = static_cast<int32_t>(tokens.size());
    int32_t rc = llama_decode(g_ctx, batch);
    llama_batch_free(batch);
    if (rc != 0) {
        return env->NewStringUTF("本地模型解码失败");
    }

    std::string output;
    const int32_t promptTokens = static_cast<int32_t>(tokens.size());
    for (int i = 0; i < limit; i++) {
        llama_token id = llama_sampler_sample(g_sampler, g_ctx, -1);
        if (llama_vocab_is_eog(llama_model_get_vocab(g_model), id)) break;

        char piece[256];
        int32_t n = llama_token_to_piece(llama_model_get_vocab(g_model), id,
                                        piece, sizeof(piece), 0, false);
        if (n > 0) output.append(piece, static_cast<size_t>(n));

        // 显式 position：单 token batch 若复用 0 位置会把 KV 覆盖掉。
        llama_batch next = llama_batch_init(1, 0, 1);
        next.token[0] = id;
        next.pos[0] = static_cast<llama_pos>(promptTokens + i);
        next.n_seq_id[0] = 1;
        next.seq_id[0][0] = 0;
        next.logits[0] = 1;
        next.n_tokens = 1;
        int32_t rcNext = llama_decode(g_ctx, next);
        llama_batch_free(next);
        if (rcNext != 0) break;
    }
    return env->NewStringUTF(output.c_str());
}

extern "C"
JNIEXPORT void JNICALL
Java_com_devterminal_model_LocalLlama_nativeFree(JNIEnv *, jobject) {
    std::lock_guard<std::mutex> guard(g_lock);
    release_all();
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_devterminal_model_LocalLlama_nativeInfo(JNIEnv *env, jobject) {
    return env->NewStringUTF(llama_print_system_info());
}
