// Node 18+ has global fetch
const url = 'http://localhost:3001/api/voice/chime/outbound';
const body = {
  destination: '+13109946837',
  from: '+17203703285',
};
(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (err) {
    console.error('Request failed:', err);
    process.exitCode = 1;
  }
})();
