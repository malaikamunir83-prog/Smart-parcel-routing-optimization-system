// ============================================================
// 1. DATA STRUCTURES (DSA CONCEPTS)
// ============================================================

class PriorityDispatchQueue {
    constructor() {
        this.heap = [];
    }
    enqueue(parcel) {
        this.heap.push(parcel);
        this.heap.sort((a, b) => b.weight - a.weight);
    }
}
const dispatchQueue = new PriorityDispatchQueue();

class DeliveryQueue {
    constructor() {
        this.queue = [];
    }
    enqueue(p) { this.queue.push(p); }
    dequeue() { return this.queue.shift(); }
}
const deliveryQueue = new DeliveryQueue();

class StatusStack {
    constructor() {
        this.stack = [];
    }
    push(status) {
        this.stack.push({
            status,
            time: new Date().toLocaleString()
        });
    }
    getAll() { return this.stack; }
}

const parcelHashTable = new Map();

// ============================================================
// 2. GEOLOCATION
// ============================================================
async function getCoordsFromAddress(address) {
    const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    const data = await res.json();
    if (!data.length) return null;
    return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
    };
}

function generateParcelId() {
    return "PID-" + Date.now();
}

// ============================================================
// 3. ADD PARCEL
// ============================================================
async function addParcel(e) {
    e.preventDefault();

    const parcel = {
        parcel_id: generateParcelId(),
        sender_name: senderName.value,
        phone: phone.value,
        pickup_address: pickupAddress.value,
        delivery_address: deliveryAddress.value,
        weight: parseFloat(weight.value),
        status: "Booked"
    };

    const res = await fetch("http://localhost:3000/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parcel)
    });

    if (!res.ok) return alert("Error saving parcel");

    const stack = new StatusStack();
    stack.push("Booked");

    parcel.statusStack = stack;
    dispatchQueue.enqueue(parcel);
    deliveryQueue.enqueue(parcel);
    parcelHashTable.set(parcel.parcel_id, parcel);

    alert("Parcel Added!\nTracking ID: " + parcel.parcel_id);
    location.href = "history.html";
}

// ============================================================
// 4. TRACK PARCEL + CORRECTED ANIMATION
// ============================================================
let map, truckMarker, animInterval;

async function trackParcel() {
    const id = parcelId.value.trim();
    if (!id) return alert("Enter Parcel ID");

    let parcel = parcelHashTable.get(id);

    if (!parcel) {
        const res = await fetch("http://localhost:3000/api/history");
        const data = await res.json();
        parcel = data.find(p => p.parcel_id === id || p._id === id);
        if (!parcel) return alert("Parcel not found");

        parcel.statusStack = new StatusStack();
        parcelHashTable.set(parcel.parcel_id, parcel);
    }

    parcel.statusStack.push("In-Transit");

    const start = await getCoordsFromAddress(parcel.pickup_address);
    const end = await getCoordsFromAddress(parcel.delivery_address);
    if (!start || !end) return alert("Location not found");

    if (map) map.remove();
    clearInterval(animInterval);

    // FIX: Initialize map without fixed view, then fit to bounds
    map = L.map("map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    // FIX: Auto-zoom map to show both points clearly
    const bounds = L.latLngBounds([start.lat, start.lon], [end.lat, end.lon]);
    map.fitBounds(bounds, { padding: [50, 50] });

    L.marker([start.lat, start.lon]).addTo(map).bindPopup("Pickup");
    L.marker([end.lat, end.lon]).addTo(map).bindPopup("Delivery");

    const route = L.polyline([
        [start.lat, start.lon],
        [end.lat, end.lon]
    ], { color: "blue", weight: 4 }).addTo(map);

    // FIX: Corrected Truck Icon with Anchor
    const truckIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/128/5428/5428466.png',
        iconSize: [40, 40],    // Reasonable size
        iconAnchor: [20, 20],  // Points to the center of the image
        popupAnchor: [0, -20]
    });

    truckMarker = L.marker([start.lat, start.lon], { icon: truckIcon }).addTo(map);

    const steps = 200;
    let i = 0;

    animInterval = setInterval(async () => {
        i++;
        const lat = start.lat + (end.lat - start.lat) * (i / steps);
        const lon = start.lon + (end.lon - start.lon) * (i / steps);

        truckMarker.setLatLng([lat, lon]);
        trackingStatus.innerText = `In Transit (${Math.floor((i / steps) * 100)}%)`;

        if (i >= steps) {
            clearInterval(animInterval);
            trackingStatus.innerText = "Delivered ✅";
            parcel.statusStack.push("Delivered");

            if(parcel._id) {
                await fetch(`http://localhost:3000/api/parcels/${parcel._id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "Delivered" })
                });
            }
        }
    }, 80);
}

// ============================================================
// 5. DISPLAY HISTORY
// ============================================================
async function displayHistory() {
    const tbody = document.getElementById("parcelTableBody");
    if (!tbody) return;

    const res = await fetch("http://localhost:3000/api/history");
    const history = await res.json();

    tbody.innerHTML = "";

    history.forEach(p => {
        parcelHashTable.set(p.parcel_id, p);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p.parcel_id}</td>
            <td>${p.sender_name}</td>
            <td>${p.phone}</td>
            <td>${p.pickup_address}</td>
            <td>${p.delivery_address}</td>
            <td>${p.weight} kg</td>
            <td>${p.status || "Booked"}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================================
// 6. INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("parcelForm");
    if (form) form.addEventListener("submit", addParcel);

    if (document.getElementById("parcelTableBody")) {
        displayHistory();
    }

    const btn = document.getElementById("trackButton");
    if (btn) btn.addEventListener("click", trackParcel);
});