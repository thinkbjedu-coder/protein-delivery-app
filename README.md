# プロテイン納品書アプリ

社内拠点間のプロテイン納品を管理するWebアプリケーションです。

## 機能

- 納品伝票の作成
- 受領確認
- 履歴管理
- CSVエクスポート
- パスワード認証
- Google Sheets連携

## ローカル開発

### 必要な環境
- Node.js 14以上

### セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. サーバーの起動:
```bash
npm start
```

3. ブラウザで開く:
```
http://localhost:3001
```

### ログイン情報
- パスワード: `think0305`

## クラウドデプロイ

### 推奨サービス
- **Render** (https://render.com)
- **Railway** (https://railway.app)
- **Fly.io** (https://fly.io)

### デプロイ手順

#### 1. GitHubにコードをプッシュ

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

#### 2. クラウドサービスでデプロイ

**Renderの場合:**
1. Renderにログイン
2. "New Web Service"を選択
3. GitHubリポジトリを接続
4. 以下の設定を入力:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. "Create Web Service"をクリック

**Railwayの場合:**
1. Railwayにログイン
2. "New Project" → "Deploy from GitHub repo"
3. リポジトリを選択
4. 自動的にデプロイが開始されます

### 環境変数

必要に応じて以下の環境変数を設定:

- `PORT`: サーバーのポート番号 (デフォルト: 3001)
- `NODE_ENV`: 環境 (production/development)

### データベース

SQLiteデータベース(`deliveries.db`)は自動的に作成されます。
クラウドサービスによっては永続ストレージの設定が必要な場合があります。

### ヘルスチェック

アプリケーションの状態を確認するエンドポイント:
```
GET /health
```

レスポンス例:
```json
{
  "status": "ok",
  "timestamp": "2025-12-02T05:00:00.000Z",
  "uptime": 123.456,
  "environment": "production"
}
```

## トラブルシューティング

### サーバーが起動しない
- Node.jsのバージョンを確認 (`node --version`)
- 依存関係を再インストール (`npm install`)

### データベースエラー
- `deliveries.db`ファイルの権限を確認
- データベースファイルを削除して再起動(データは失われます)

### デプロイ後にアクセスできない
- ヘルスチェックエンドポイント(`/health`)を確認
- ログを確認してエラーメッセージを確認

## ライセンス

ISC
