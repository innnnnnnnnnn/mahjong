# 🀄 台灣 16 張麻將連線對戰 (Taiwan Mahjong 16) — v1.0.0

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/innnnnnnnnnn/mahjong/releases/tag/v1.0.0)

這是一個基於 React + TypeScript + Socket.io 開發的現代化台灣 16 張麻將連線對局系統。支援多人即時對戰、豐富的角色配音、以及全自動化的智能遊戲流程。

---

## ✨ 核心特色 (Key Features)

- **🌐 多人即時連線**：支援房間系統，可透過邀請連結快速讓朋友加入對局。
- **🤖 智能 AI 對手**：內建多位具備語音配音的 AI 角色，填補玩家空位。
- **⚡ 全自動化流程**：
    - **自動摸牌**：無需手動點擊，流暢的發牌與補花體驗。
    - **自動整理**：手牌自動分類排列（萬、筒、條、字）。
    - **聽牌代打**：一鍵開啟聽牌模式，系統自動執行最優出牌與即時胡牌。
- **🎨 現代化 UI/UX**：
    - 採用磨砂玻璃質感 (Glassmorphism) 設計。
    - 豐富的動態效果（擲骰子、摸牌、胡牌特效）。
    - 完整的結算畫面，自動計算台數與分數。
- **🔊 視聽享受**：支援多角色真人配音與背景音樂，提升遊戲沈浸感。
- **📲 LINE 整合**：預留 LINE LIFF 登入介面，方便行動端快速遊玩。

---

## 🚀 技術棧 (Tech Stack)

### 前端 (Frontend)
- **React 19**：高效的組件化介面開發。
- **TypeScript**：嚴謹的型別檢查，降低錯誤機率。
- **Vite**：極速的開發環境與建置工具。
- **Framer Motion**：流畅的 UI 動畫與轉場。
- **Socket.io Client**：實現即時雙向通訊。

### 後端 (Backend)
- **Node.js**：輕量級高效能 Server 環境。
- **Socket.io**：穩定的多人連線管理與狀態同步。

---

## 🛠️ 快速開始 (Quick Start)

### 1. 安裝依賴
```bash
# 前端與後端共用依賴安裝
npm install
cd server
npm install
cd ..
```

### 2. 本地開發
啟動前端開發伺服器：
```bash
npm run dev
```

啟動後端 Socket 伺服器：
```bash
cd server
node index.js
```

### 3. 生產環境建置
```bash
npm run build
```

---

## 🀄 遊戲規則簡介

1. **基本玩法**：每位玩家手牌 16 張，胡牌時需湊齊 5 副順子、刻子或槓子，加上 1 對將（眼）。
2. **莊家與連莊**：由骰子決定起莊位，胡牌或流局時若莊家獲勝則連莊。
3. **台數計算**：支援台灣麻將標準台數計算（如：門清、自摸、莊家、花牌、風牌、三元牌等）。
4. **流局**：牌堆剩餘 16 張時若無人胡牌則判定為流局。

---

## 🗺️ 未來展望 (Roadmap)

- [ ] 加入更豐富的 3D 麻將牌桌視覺效果。
- [ ] 支援更多樣化的角色造型與個人化配件。
- [ ] 整合排行榜與歷史對戰紀錄。
- [ ] 增加更多語系支援（簡體中文、英文、日文）。

---

## 📄 授權協議 (License)

本專案採用 [MIT License](LICENSE) 授權。

---

## 👨‍💻 作者 (Author)

[innnnnnnnnnn](https://github.com/innnnnnnnnnn)

如有任何問題或建議，歡迎透過 Issue 聯繫！
