# Annotation Timeline

Tauri v2 + React + TypeScript で動作する動画アノテーション用デスクトップアプリです。手動で発話区間を作成し、文字起こしと感情ラベルを付けて `.ann` / CSV を出力します。

## Dev起動手順
1. Node.js と Rust をインストールします。
2. 依存関係をインストールします。
   ```bash
   npm install
   ```
3. 開発モードで起動します。
   ```bash
   npm run tauri dev
   ```

## ビルド手順
### Windows
```bash
npm run tauri build
```

### macOS
```bash
npm run tauri build
```

> macOS では Xcode Command Line Tools が必要です。

## 使い方
1. 「動画を選択」で動画を開く。
2. 役割（A/B/C/D）を選択する。
3. 「labels.xmlを選択」でラベルXMLを読み込む。
4. タイムラインをクリックして区間を作成し、必要に応じてドラッグで開始/終了を調整する。
5. ダブルクリックまたは右クリック「文字起こしを入力」でテキストを入力する。
6. 右クリック「ラベルを選択」からラベルを付与する。
7. 「Save .ann」でプロジェクトを保存し、「CSV出力」で1つのCSVを出力する。

## テスト
```bash
npm run test
```
