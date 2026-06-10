import { View, Text } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import "./history.scss";

interface HistoryItem {
  id: string;
  inputName: string;
  inputFormat: string;
  outputFormat: string;
  status: string;
  date: string;
  size: string;
}

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    setLoading(false);
    setItems([]);
  });

  return (
    <View className="history-page">
      <Text className="page-title">转换历史</Text>

      {loading ? (
        <View className="loading">
          <Text>加载中...</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="empty">
          <Text className="empty-icon">📭</Text>
          <Text className="empty-text">暂无转换记录</Text>
          <Text className="empty-hint">快去转换一个文档吧！</Text>
        </View>
      ) : (
        <View className="history-list">
          {items.map((item) => (
            <View key={item.id} className="history-item">
              <View className="item-header">
                <Text className="item-name">{item.inputName}</Text>
                <Text className={`item-status status-${item.status}`}>{item.status}</Text>
              </View>
              <View className="item-meta">
                <Text className="item-format">
                  {item.inputFormat} → {item.outputFormat}
                </Text>
                <Text className="item-size">{item.size}</Text>
              </View>
              <Text className="item-date">{item.date}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
