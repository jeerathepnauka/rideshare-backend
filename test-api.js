fetch('http://localhost:3000/api/driver/update-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // จำลองส่งข้อมูลคนขับรหัส 001 ในจังหวัดเชียงราย
    body: JSON.stringify({
        driverId: 'driver_001',
        province: 'chiang_rai',
        lat: 19.9896,
        lng: 99.8280
    })
})
.then(res => res.json())
.then(data => console.log('ผลลัพธ์จากเซิร์ฟเวอร์:', data))
.catch(err => console.error('Error:', err));