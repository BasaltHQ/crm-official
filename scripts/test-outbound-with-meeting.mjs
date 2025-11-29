// End-to-end test: create meeting then place outbound with meetingId
const base = 'http://localhost:3000';
async function post(path, body) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}
(async () => {
  try {
    console.log('Creating meeting...');
    const cm = await post('/api/voice/chime/create-meeting');
    console.log('Create-meeting status:', cm.status);
    console.log('Create-meeting resp:', JSON.stringify(cm.json));
    if (cm.status !== 200 || !cm.json?.meeting?.MeetingId) {
      console.error('Failed to create meeting');
      process.exit(1);
    }
    const meetingId = cm.json.meeting.MeetingId;
    console.log('Placing outbound with meetingId:', meetingId);
    const ob = await post('/api/voice/chime/outbound', {
      destination: '+13109946837',
      from: '+17203703285',
      meetingId,
    });
    console.log('Outbound status:', ob.status);
    console.log('Outbound resp:', JSON.stringify(ob.json));
    console.log('If call is ringing, please answer to trigger CALL_ANSWERED and SMA join.');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  }
})();
