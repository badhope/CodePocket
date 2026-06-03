import { type PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('DocForge Mini Program launched.')
  })

  return children
}

export default App