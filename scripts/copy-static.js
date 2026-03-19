/**
 * 跨平台复制静态文件脚本
 * 用于将 .next/static 和 public 目录复制到 standalone 目录
 */

const fs = require('fs')
const path = require('path')

// 目标目录
const standaloneDir = path.join(__dirname, '..', '.next', 'standalone')
const staticSrc = path.join(__dirname, '..', '.next', 'static')
const staticDest = path.join(standaloneDir, '.next', 'static')
const publicSrc = path.join(__dirname, '..', 'public')
const publicDest = path.join(standaloneDir, 'public')

// 递归复制目录
function copyDir(src, dest) {
  // 创建目标目录
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  // 读取源目录
  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// 主函数
function main() {
  console.log('复制静态文件到 standalone 目录...')

  try {
    // 检查 standalone 目录是否存在
    if (!fs.existsSync(standaloneDir)) {
      console.log('standalone 目录不存在，跳过复制')
      return
    }

    // 复制 .next/static
    if (fs.existsSync(staticSrc)) {
      console.log('复制 .next/static...')
      copyDir(staticSrc, staticDest)
      console.log('✓ .next/static 复制完成')
    }

    // 复制 public
    if (fs.existsSync(publicSrc)) {
      console.log('复制 public...')
      copyDir(publicSrc, publicDest)
      console.log('✓ public 复制完成')
    }

    console.log('静态文件复制完成！')
  } catch (error) {
    console.error('复制文件时出错:', error.message)
    process.exit(1)
  }
}

main()
