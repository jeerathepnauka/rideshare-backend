const express = require('express');
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://applicationthep-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = getDatabase();
const app = express();
app.use(express.json());
const cors = require('cors');
app.use(cors());
// เส้นทางทดสอบเซิร์ฟเวอร์
app.get('/', (req, res) => {
  res.send('ระบบหลังบ้าน (Backend) เริ่มต้นทำงานสมบูรณ์แล้ว!');
});

// API สำหรับรับพิกัดจากคนขับเพื่ออัปเดตลงฐานข้อมูล
app.post('/api/driver/update-location', (req, res) => {
  const { driverId, province, lat, lng } = req.body;

  if (!driverId || !province || !lat || !lng) {
    return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
  }

  const driverRef = db.ref(`active_drivers/${province}/${driverId}`);
  
  driverRef.set({
    lat: lat,
    lng: lng,
    status: "available",
    timestamp: Date.now()
  })
  .then(() => res.json({ success: true, message: "อัปเดตตำแหน่งลง Firebase สำเร็จ!" }))
  .catch((error) => res.status(500).json({ error: error.message }));
});

// API สำหรับผู้โดยสารค้นหาคนขับที่ออนไลน์อยู่ในจังหวัดนั้นๆ
app.get('/api/drivers/nearby/:province', (req, res) => {
  const { province } = req.params;

  const provinceRef = db.ref(`active_drivers/${province}`);
  
  provinceRef.once('value', (snapshot) => {
    const drivers = snapshot.val();
    
    if (!drivers) {
      return res.json({ success: true, drivers: [], message: "ไม่พบคนขับในพื้นที่นี้ในขณะนี้" });
    }

    const driverList = Object.keys(drivers).map(driverId => ({
      driverId: driverId,
      ...drivers[driverId]
    }));

    res.json({ success: true, count: driverList.length, drivers: driverList });
  }, (error) => {
    res.status(500).json({ error: error.message });
  });
});

// API สำหรับผู้โดยสารสร้างคำขอเรียกรถ
app.post('/api/ride/request', (req, res) => {
  const { passengerId, province, pickup, destination } = req.body;

  if (!passengerId || !province || !pickup || !destination) {
    return res.status(400).json({ error: "กรุณาระบุข้อมูลการเดินทางให้ครบถ้วน" });
  }

  const rideRef = db.ref(`ride_requests/${province}`).push();
  
  const rideData = {
    passengerId: passengerId,
    pickup: pickup,
    destination: destination,
    status: "searching",
    createdAt: Date.now()
  };

  rideRef.set(rideData)
    .then(() => {
      res.json({ 
        success: true, 
        rideId: rideRef.key, 
        message: "สร้างคำขอเรียกรถสำเร็จ กำลังค้นหาคนขับใกล้คุณ..." 
      });
    })
    .catch((error) => res.status(500).json({ error: error.message }));
});

// API สำหรับคนขับกดรับคำขอเรียกรถ (ชุดที่ถูกต้องชุดเดียว)
app.post('/api/ride/accept', async (req, res) => {
  try {
    const { driverId, rideId, province } = req.body;

    if (!driverId || !rideId || !province) {
      return res.status(400).json({ error: "กรุณาระบุข้อมูลให้ครบถ้วน" });
    }

    const rideRef = db.ref(`ride_requests/${province}/${rideId}`);
    const snapshot = await rideRef.once('value');
    const rideData = snapshot.val();

    if (!rideData) {
      return res.status(404).json({ error: "ไม่พบคำขอนี้ หรืออาจถูกยกเลิกไปแล้ว" });
    }

    if (rideData.status !== "searching") {
      return res.status(400).json({ error: "ขออภัย งานนี้มีคนขับรับไปแล้ว" });
    }

    await rideRef.update({
      status: "accepted",
      driverId: driverId,
      acceptedAt: Date.now()
    });

    await db.ref(`active_drivers/${province}/${driverId}`).update({ status: "busy" });

    return res.json({ 
      success: true, 
      message: "รับงานสำเร็จ! กำลังเดินทางไปรับผู้โดยสาร" 
    });

  } catch (error) {
    console.error("Error รับงาน:", error);
    return res.status(500).json({ error: error.message });
  }
});

// API สำหรับคนขับแจ้งว่า "ถึงจุดรับผู้โดยสารแล้ว"
app.post('/api/ride/arrived', async (req, res) => {
  try {
    const { driverId, rideId, province } = req.body;
    if (!driverId || !rideId || !province) {
      return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
    }

    await db.ref(`ride_requests/${province}/${rideId}`).update({
      status: "arrived",
      arrivedAt: Date.now()
    });

    return res.json({ success: true, message: "อัปเดตสถานะ: คนขับมาถึงจุดรับแล้ว!" });
  } catch (error) {
    console.error("Error arrived:", error);
    return res.status(500).json({ error: error.message });
  }
});

// API สำหรับคนขับแจ้งว่า "ส่งผู้โดยสารถึงที่หมายสำเร็จ" (จบงาน)
app.post('/api/ride/complete', async (req, res) => {
  try {
    const { driverId, rideId, province } = req.body;
    if (!driverId || !rideId || !province) {
      return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
    }

    // 1. อัปเดตสถานะงานเป็น completed
    await db.ref(`ride_requests/${province}/${rideId}`).update({
      status: "completed",
      completedAt: Date.now()
    });

    // 2. ปรับสถานะคนขับกลับเป็น available เพื่อรอรับงานใหม่
    await db.ref(`active_drivers/${province}/${driverId}`).update({ 
      status: "available" 
    });

    return res.json({ success: true, message: "จบงานสำเร็จ! คนขับกลับสู่สถานะพร้อมรับงานใหม่" });
  } catch (error) {
    console.error("Error complete:", error);
    return res.status(500).json({ error: error.message });
  }
});
// API สำหรับผู้โดยสารเพื่อคอยเช็คสถานะการเรียกรถ
app.get('/api/ride/status/:province/:rideId', async (req, res) => {
  try {
    const { province, rideId } = req.params;
    const snapshot = await db.ref(`ride_requests/${province}/${rideId}`).once('value');
    const rideData = snapshot.val();

    if (!rideData) {
      return res.status(404).json({ error: "ไม่พบข้อมูลคำขอนี้" });
    }

    // เพิ่มการส่ง pickup และ destination ไปให้ฝั่งคนขับใช้งาน
    return res.json({ 
      success: true, 
      status: rideData.status,
      pickup: rideData.pickup,
      destination: rideData.destination 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
// เปิดพอร์ตทำงาน
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server กำลังทำงานอยู่ที่ http://localhost:${PORT}`);
});