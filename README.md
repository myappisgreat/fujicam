# FUJI ROOM

手機優先的復古相機 PWA。原生 HTML / CSS / JavaScript + WebGL 2，無建置步驟、無雲端照片上傳。

## 功能

- 前後鏡頭即時取景、JPEG 拍照、手機系統分享與下載。
- 匯入 JPEG / PNG / WebP 照片，可離線編輯。
- X-T5 官方 ETERNA、ETERNA Bleach Bypass、WDR 33³ LUT；MONO 使用 ETERNA 後轉黑白。
- 曝光 ±2 EV、顆粒、色溫（冷／暖）、色調（綠／洋紅）、輕微暗角。色溫與色調範圍為 -100 至 +100，0 為中性，屬於創意相對調整而非 Kelvin 測量，於 LUT 前套用。輸出與取景相同比例，長邊最多 2400px，不放大原圖。
- PWA 主畫面安裝、應用程式與三款 LUT 離線快取。

## 本機啟動

```sh
python -m http.server 4173
```

電腦開啟 http://localhost:4173。相機權限需要 HTTPS 或 localhost；手機不能直接使用電腦 LAN 的 HTTP 網址取得鏡頭，請部署至 HTTPS 網站。

## GitHub Pages

本專案提供 `.github/workflows/pages.yml`。在 GitHub 儲存庫 Settings → Pages → Source 選擇 **GitHub Actions**，將程式推送至 `main`，或手動執行 workflow。

預期網址：`https://myappisgreat.github.io/fujicam/`（須成功部署才可使用）。若預設分支不是 `main`，請更新 workflow 的分支。

iPhone 使用 Safari 開啟，分享 → 加入主畫面；Android 使用 Chrome 安裝應用程式。第一次在線成功載入並完成 service worker 快取後，才可離線使用。升級靜態檔案時請更新 `sw.js` 的 CACHE 版本；新版會在舊頁面關閉後啟用。

## 色彩處理與來源

`assets/luts/` 的三個 .cube 原樣解壓自 `LUT/x-t5-3d-lut-v100.zip` 的 F-Log 資料夾。原始 LUT 及壓縮檔由 FUJIFILM Corporation 提供，權利仍屬原提供者；專案程式碼授權不更改第三方資產的授權。

手機影像通常已經過裝置的曝光、白平衡與色調處理，不能還原富士相機的原始感光資料。本程式採用 sRGB 解碼 → 線性 BT.709 到 BT.2020 / F-Gamut 矩陣 → F-Log 編碼 → 官方 LUT 的三線性內插。這是創意風格近似，不宣稱等同富士相機的底片模擬。LUT 上傳為 RGBA8 3D texture 以兼容行動裝置，因此有 8-bit 量化。顆粒與暗角在 LUT 後套用。

F-Log 公式來源：[Fujifilm F-Log Data Sheet](https://dl.fujifilm-x.com/support/lut/F-Log_DataSheet_E_Ver.1.0.pdf)。本專案非富士官方產品。

## 驗證

```sh
node tests/lut.test.mjs
```

測試三個 LUT 資料尺寸、紅／藍軸排列及格式錯誤處理。瀏覽器需要 WebGL 2；相機權限、iOS 安裝與系統相片分享仍需在實機確認。

手機使用方形取景，桌面為 4:3。另提供 tests/browser-check.cjs 可用 Playwright 與已安裝的 Chrome 驗證模擬相機、JPEG 匯出、黑白模式與離線 LUT；需先安裝 playwright 後執行 node tests/browser-check.cjs。測試會自行啟動本機伺服器。
