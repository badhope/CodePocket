export default defineAppConfig({
  pages: ["pages/index/index", "pages/convert/convert", "pages/history/history"],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#fff",
    navigationBarTitleText: "DocForge",
    navigationBarTextStyle: "black",
  },
  tabBar: {
    color: "#999",
    selectedColor: "#333",
    backgroundColor: "#fff",
    list: [
      {
        pagePath: "pages/index/index",
        text: "首页",
        iconPath: "assets/tab-home.png",
        selectedIconPath: "assets/tab-home-active.png",
      },
      {
        pagePath: "pages/convert/convert",
        text: "转换",
        iconPath: "assets/tab-convert.png",
        selectedIconPath: "assets/tab-convert-active.png",
      },
      {
        pagePath: "pages/history/history",
        text: "历史",
        iconPath: "assets/tab-history.png",
        selectedIconPath: "assets/tab-history-active.png",
      },
    ],
  },
});
