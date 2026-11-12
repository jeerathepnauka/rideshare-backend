fetch('http://localhost:3000/api/ride/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        passengerId: 'passenger_001',
        province: 'chiang_rai',
        pickup: { lat: 19.9036, lng: 99.8360 },
        destination: { lat: 19.9896, lng: 99.8280 }
    })
})
.then(res => res.json())
.then(data => {
    console.log('ผลลัพธ์การเรียกรถ:', data);
    console.log('รหัส rideId ที่ต้องนำไปใช้:', data.rideId); // สั่งให้พิมพ์ rideId ออกมาตรงนี้ชัดๆ
})
.catch(err => console.error('Error:', err));