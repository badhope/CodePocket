import { View, Text, Button, Picker } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import './convert.scss'

const OUTPUT_FORMATS = [
  { label: 'PDF', value: 'pdf' },
  { label: 'DOCX', value: 'docx' },
  { label: 'HTML', value: 'html' },
  { label: 'Markdown', value: 'md' },
  { label: 'TXT', value: 'txt' },
  { label: 'CSV', value: 'csv' },
  { label: 'JSON', value: 'json' },
  { label: 'XLSX', value: 'xlsx' },
]

export default function Convert() {
  const [selectedFile, setSelectedFile] = useState<{ name: string; path: string; size: number } | null>(null)
  const [outputFormat, setOutputFormat] = useState('pdf')
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<string | null>(null)

  const handleChooseFile = () => {
    Taro.chooseMessageFile({
      count: 1,
      type: 'file',
      success(res) {
        const file = res.tempFiles[0]
        if (file) {
          setSelectedFile({ name: file.name, path: file.path, size: file.size })
          setResult(null)
        }
      },
      fail(err) {
        console.error('Choose file failed:', err)
      }
    })
  }

  const handleOutputChange = (e: unknown) => {
    const value = (e as { detail: { value: number } }).detail.value
    setOutputFormat(OUTPUT_FORMATS[value]?.value ?? 'pdf')
  }

  const handleConvert = async () => {
    if (!selectedFile) {
      Taro.showToast({ title: '请先选择文件', icon: 'none' })
      return
    }

    setConverting(true)
    setProgress(0)

    try {
      const progressTimer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressTimer)
            return 90
          }
          return prev + 10
        })
      }, 300)

      await new Promise((resolve) => setTimeout(resolve, 2000))

      clearInterval(progressTimer)
      setProgress(100)
      setResult(`${selectedFile.name.replace(/\.[^.]+$/, '')}.${outputFormat}`)
      Taro.showToast({ title: '转换完成', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: '转换失败', icon: 'error' })
    } finally {
      setConverting(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setResult(null)
    setProgress(0)
  }

  return (
    <View className="convert-page">
      <View className="upload-section">
        <Text className="section-title">选择文件</Text>
        {selectedFile ? (
          <View className="file-info">
            <Text className="file-name">{selectedFile.name}</Text>
            <Text className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</Text>
            <Button className="btn-reselect" onClick={handleChooseFile}>重新选择</Button>
          </View>
        ) : (
          <View className="upload-area" onClick={handleChooseFile}>
            <Text className="upload-icon">📁</Text>
            <Text className="upload-text">点击选择文件</Text>
            <Text className="upload-hint">支持 DOCX, PDF, MD, HTML, TXT, XLSX, CSV, JSON</Text>
          </View>
        )}
      </View>

      <View className="format-section">
        <Text className="section-title">输出格式</Text>
        <Picker mode="selector" range={OUTPUT_FORMATS.map(f => f.label)} onChange={handleOutputChange}>
          <View className="picker">
            <Text>{OUTPUT_FORMATS.find(f => f.value === outputFormat)?.label ?? 'PDF'}</Text>
            <Text className="picker-arrow">▼</Text>
          </View>
        </Picker>
      </View>

      {converting && (
        <View className="progress-section">
          <Text className="progress-text">转换中... {progress}%</Text>
          <View className="progress-bar">
            <View className="progress-fill" style={{ width: `${progress}%` }} />
          </View>
        </View>
      )}

      {result && (
        <View className="result-section">
          <Text className="result-icon">✅</Text>
          <Text className="result-text">转换完成</Text>
          <Text className="result-file">{result}</Text>
        </View>
      )}

      <View className="actions">
        {!result ? (
          <Button
            className="btn-convert"
            onClick={handleConvert}
            disabled={!selectedFile || converting}
            loading={converting}
          >
            {converting ? '转换中...' : '开始转换'}
          </Button>
        ) : (
          <Button className="btn-reset" onClick={handleReset}>
            转换另一个文件
          </Button>
        )}
      </View>
    </View>
  )
}