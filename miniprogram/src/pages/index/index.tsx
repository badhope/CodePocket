import { View, Text, Button } from '@tarojs/components'
import { navigateTo } from '@tarojs/taro'
import './index.scss'

export default function Index() {
  const formats = [
    { name: 'DOCX', icon: '📄', color: '#2196F3' },
    { name: 'PDF', icon: '📑', color: '#F44336' },
    { name: 'Markdown', icon: '📝', color: '#9C27B0' },
    { name: 'HTML', icon: '🌐', color: '#FF9800' },
    { name: 'XLSX/CSV', icon: '📊', color: '#4CAF50' },
    { name: 'TXT/JSON', icon: '📋', color: '#607D8B' },
  ]

  const handleStartConvert = () => {
    navigateTo({ url: '/pages/convert/convert' })
  }

  return (
    <View className="index-page">
      <View className="hero">
        <Text className="hero-title">DocForge</Text>
        <Text className="hero-subtitle">全能文档转换平台</Text>
        <Text className="hero-desc">支持 DOCX、PDF、Markdown、HTML、Excel 等格式互转</Text>
        <Button className="hero-btn" onClick={handleStartConvert}>开始转换</Button>
      </View>

      <View className="formats-section">
        <Text className="section-title">支持的格式</Text>
        <View className="formats-grid">
          {formats.map((fmt) => (
            <View key={fmt.name} className="format-item">
              <Text className="format-icon">{fmt.icon}</Text>
              <Text className="format-name">{fmt.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="steps-section">
        <Text className="section-title">如何使用</Text>
        <View className="steps">
          <View className="step-item">
            <View className="step-number"><Text>1</Text></View>
            <Text className="step-title">上传文件</Text>
            <Text className="step-desc">选择要转换的文档</Text>
          </View>
          <View className="step-item">
            <View className="step-number"><Text>2</Text></View>
            <Text className="step-title">选择格式</Text>
            <Text className="step-desc">选择目标输出格式</Text>
          </View>
          <View className="step-item">
            <View className="step-number"><Text>3</Text></View>
            <Text className="step-title">一键转换</Text>
            <Text className="step-desc">点击按钮开始转换</Text>
          </View>
          <View className="step-item">
            <View className="step-number"><Text>4</Text></View>
            <Text className="step-title">下载结果</Text>
            <Text className="step-desc">保存转换后的文件</Text>
          </View>
        </View>
      </View>
    </View>
  )
}