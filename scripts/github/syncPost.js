name: Sync Post

# Controls when the workflow will run
on:
  # schedule:
  #   - cron: "30 1 * * *"
  # https://docs.github.com/cn/developers/webhooks-and-events/events/issue-event-types
  issues:
    types:
      - opened
      - closed
      - edited
      - renamed
      - labeled
      - unlabeled
      - reopened
      - committed # 修改？
  workflow_dispatch:

# Avoid overlapping runs when multiple issue events happen in quick
# succession (e.g., labeling and editing) to prevent duplicate CI
# executions for the same trigger.
concurrency:
  group: sync-post-${{ github.event.issue.number || github.run_id }}
  cancel-in-progress: true

jobs:
  Publish:
    runs-on: ubuntu-latest
    
    # 🔥 环境变量必须在这里定义！
    env:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
      GH_USER: ${{ secrets.GH_USER }}
      GH_PROJECT_NAME: ${{ secrets.GH_PROJECT_NAME }}
    
    steps:
      - name: Checkout 🛎️
        uses: actions/checkout@v2

      - name: Setup Node.js 🚀
        uses: actions/setup-node@v3
        with:
          node-version: '20.11.0'

      - name: Git config 🔧
        run: |
          git config --global user.name "willson369"
          git config --global user.email "zhangziliuqlu@gmail.com"

      - name: Display env info ✨
        run: |
          echo '环境变量检查：'
          echo 'GH_USER: $GH_USER'
          echo 'GH_PROJECT_NAME: $GH_PROJECT_NAME'
          echo 'GH_TOKEN 存在: $([ -n "$GH_TOKEN" ] && echo "是" || echo "否")'
          echo '当前目录：'
          pwd

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9.6.0

      - name: Install 🔧
        run: pnpm install

      # - name: Build ⛏️
      #   run: pnpm run build

      - name: Update blog files ⛏️
        run: |
          pnpm run sync-post
          git add .
          git commit -m 'chore(ci): blog sync'

      - name: Pull latest changes from remote
        run: git pull --rebase origin main

      - name: Push changes to remote
        run: git push
