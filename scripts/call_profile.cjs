(async()=>{
  const token = '***REMOVED***';
  const res = await fetch('http://localhost:4000/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } });
  const t = await res.text();
  console.log('status', res.status);
  console.log(t);
})();
