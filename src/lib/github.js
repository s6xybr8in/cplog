function toBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function fromBase64(b64) {
  const binary = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}



async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function ghFetch(pat, path, opts = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  })
}

export { toBase64, fromBase64, safeJson, ghFetch }
