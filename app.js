const apiKey = document.getElementById('apiKey');
const lang = document.getElementById('lang');
const fileInput = document.getElementById('file');
const btn = document.getElementById('btn');
const bar = document.getElementById('bar');
const status = document.getElementById('status');

let content = null;
let fileName = 'translated.srt';

fileInput.onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  fileName = f.name.replace('.srt', '') + '_translated.srt';
  const reader = new FileReader();
  reader.onload = ev => {
    content = ev.target.result;
    btn.disabled = false;
    status.textContent = 'File loaded ✓';
  };
  reader.readAsText(f);
};

btn.onclick = start;

function parseSRT(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  return blocks.map(b => {
    const lines = b.split('\n');
    return {
      index: lines[0],
      time: lines[1],
      text: lines.slice(2).join('\n')
    };
  }).filter(e => e.text);
}

function makeSRT(entries) {
  return entries.map(e => `\( {e.index}\n \){e.time}\n${e.text}`).join('\n\n') + '\n';
}

async function translate(texts, key, language) {
  const prompt = `You are a professional subtitle translator.
Translate these subtitle lines into ${language}.
Keep the exact same number of lines.
Return ONLY the translated lines, one per line. No numbers, no explanations.

\( {texts.map((t,i) => ` \){i+1}. ${t}`).join('\n')}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.href,
      'X-Title': 'OpenRouter SubZ'
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });

  if (!res.ok) throw new Error('API Error: ' + res.status);
  const data = await res.json();
  const raw = data.choices[0].message.content.trim();
  return raw.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim());
}

async function start() {
  const key = apiKey.value.trim();
  if (!key) return alert('API Key එක දාන්න');
  if (!content) return;

  btn.disabled = true;
  status.textContent = 'Starting...';
  bar.style.width = '0%';

  const entries = parseSRT(content);
  const batchSize = 12;
  const result = [];
  const total = Math.ceil(entries.length / batchSize);

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const texts = batch.map(e => e.text);
    const num = Math.floor(i / batchSize) + 1;

    status.textContent = `Translating \( {num}/ \){total}...`;
    bar.style.width = ((num-1)/total*100) + '%';

    try {
      const translated = await translate(texts, key, lang.value);
      for (let j = 0; j < batch.length; j++) {
        result.push({
          ...batch[j],
          text: translated[j] || batch[j].text
        });
      }
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      btn.disabled = false;
      return;
    }

    await new Promise(r => setTimeout(r, 1600)); // rate limit ආරක්ෂාව
  }

  bar.style.width = '100%';
  status.textContent = 'Done! Downloading...';

  const final = makeSRT(result);
  const blob = new Blob([final], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();

  status.textContent = 'සාර්ථකයි! File එක download වුණා';
  btn.disabled = false;
}
