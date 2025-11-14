#!/usr/bin/env node

/* eslint-disable no-console */

const readline = require('readline')
const { TelegramClient } = require('telegram')
const { StringSession } = require('telegram/sessions')

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config()
} catch {
  // dotenv необязателен
}

function ask(question, mask = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: mask ? undefined : process.stdout,
  })

  return new Promise((resolve) => {
    if (mask) {
      process.stdout.write(question)
      const stdin = process.openStdin()
      const onData = (char) => {
        char = char + ''
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.removeListener('data', onData)
            break
          default:
            process.stdout.write('\x1B[2K\x1B[200D')
            process.stdout.write(question + Array(rl.line.length + 1).join('*'))
            break
        }
      }
      stdin.on('data', onData)
    }

    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  console.log('=== Telegram session generator ===\n')

  const apiIdInput = await ask(
    `Telegram API ID (${process.env.TELEGRAM_API_ID || 'введите число'}): `
  )
  const apiHashInput = await ask(
    `Telegram API Hash (${process.env.TELEGRAM_API_HASH ? '***' : 'введите строку'}): `,
    false
  )

  const apiId = Number(apiIdInput || process.env.TELEGRAM_API_ID)
  const apiHash = apiHashInput || process.env.TELEGRAM_API_HASH

  if (!apiId || !apiHash) {
    throw new Error('API ID и API Hash обязательны')
  }

  const phoneNumber = await ask('Номер телефона (в международном формате, например +79991234567): ')
  if (!phoneNumber) {
    throw new Error('Номер телефона обязателен')
  }

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  })

  try {
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => await ask('Пароль 2FA (если нет — просто Enter): ', true),
      phoneCode: async () => await ask('Код из Telegram: '),
      onError: (error) => console.error('Telegram error:', error),
    })

    const session = client.session.save()
    console.log('\n✅ Авторизация прошла успешно.')
    console.log('Скопируйте строку ниже и сохраните в TELEGRAM_SESSION или в админке:\n')
    console.log(session)
  } finally {
    await client.disconnect()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nОшибка генерации session:', error.message)
    process.exit(1)
  })

