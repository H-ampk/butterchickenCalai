import { writeFileSync } from 'node:fs'
import { renderDevelopmentSeedSql } from '../src/developmentSeed.ts'

const target = new URL('../seeds/development.sql', import.meta.url)
writeFileSync(target, renderDevelopmentSeedSql(), 'utf8')
console.log('workers/seeds/development.sql を生成しました。')
