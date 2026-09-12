// Best-effort voice input helper for AIUI.
//
// Uses the Web SpeechRecognition surface shown in the AIUI docs. On devices
// where it is unavailable, the page simply reports a voice error and the user
// can still navigate with the touchpad.

export function createVoiceController(options) {
  const handlers = options || {}
  let recognition = null
  let listening = false

  function available() {
    return typeof SpeechRecognition === 'function'
  }

  function pickText(event) {
    let partial = ''
    let final = ''
    const results = event && event.results ? event.results : []
    for (let index = event.resultIndex || 0; index < results.length; index += 1) {
      const result = results[index]
      const alternative = result && result[0] ? result[0] : undefined
      const text = alternative && alternative.transcript ? alternative.transcript : ''
      if (result && result.isFinal) final += text
      else partial += text
    }
    return { partial: partial, final: final }
  }

  function start() {
    if (listening) return true
    if (available() === false) {
      if (handlers.onError) handlers.onError('当前设备不支持 SpeechRecognition')
      return false
    }
    recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onresult = (event) => {
      const picked = pickText(event)
      if (picked.partial && handlers.onPartial) handlers.onPartial(picked.partial)
      if (picked.final && handlers.onFinal) handlers.onFinal(picked.final)
    }
    recognition.onerror = (event) => {
      listening = false
      if (handlers.onError) handlers.onError(event && event.error ? event.error : 'voice error')
    }
    recognition.onend = () => {
      listening = false
      if (handlers.onEnd) handlers.onEnd()
    }
    recognition.start()
    listening = true
    if (handlers.onStart) handlers.onStart()
    return true
  }

  function stop() {
    if (recognition && listening) {
      try {
        recognition.stop()
      } catch (error) {
        // Ignore duplicate stop calls from the hardware gesture layer.
      }
    }
    listening = false
  }

  return {
    available: available,
    isListening: () => listening,
    start: start,
    stop: stop,
  }
}
