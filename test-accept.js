async function testRideStatus() {
    const payload = {
        driverId: 'driver_001',
        province: 'chiang_rai',
        rideId: '-P5eRTcv2TSsBrrVCMAJ' // รหัสงานล่าสุดที่คุณเพิ่งกดรับไป
    };

    try {
        console.log('1. จำลองคนขับกดปุ่ม "ถึงจุดรับแล้ว"...');
        const arriveRes = await fetch('http://localhost:3000/api/ride/arrived', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('ผลลัพธ์:', await arriveRes.json());

        console.log('\n2. จำลองคนขับขับไปถึงปลายทาง และกดปุ่ม "จบงาน"...');
        const completeRes = await fetch('http://localhost:3000/api/ride/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('ผลลัพธ์:', await completeRes.json());

    } catch (err) {
        console.error('Error:', err);
    }
}

testRideStatus();