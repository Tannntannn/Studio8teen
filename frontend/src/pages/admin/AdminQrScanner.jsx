import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaCheckCircle, FaExclamationTriangle, FaQrcode, FaVideo } from "react-icons/fa";
import { Html5Qrcode } from "html5-qrcode";
import AdminLayout from "../../components/layout/AdminLayout";
import { getBookingByQrToken } from "../../services/bookings";
import { extractQrToken } from "../../lib/bookingReceipt";

const SCANNER_ID = "admin-qr-scanner";

const SCANNER_CONFIG = {
  fps: 10,
  qrbox: (viewfinderWidth, viewfinderHeight) => {
    const size = Math.min(viewfinderWidth, viewfinderHeight, 320) * 0.75;
    return { width: size, height: size };
  },
  aspectRatio: 1,
};

function pickDefaultCamera(devices) {
  if (!devices?.length) return "";
  const external = devices.find((d) => /usb|external|hd|logitech|webcam|c920|camera/i.test(d.label));
  const integrated = devices.find((d) => /facetime|integrated|built-in|laptop|front/i.test(d.label));
  return external?.id || integrated?.id || devices[devices.length - 1]?.id || devices[0].id;
}

function buildCameraConfigs(deviceId) {
  const configs = [];
  if (deviceId) {
    configs.push({ deviceId: { exact: deviceId } });
    configs.push({ deviceId });
  }
  configs.push({ facingMode: "user" });
  configs.push({ facingMode: "environment" });
  return configs;
}

export default function AdminQrScanner() {
  const scannerRef = useRef(null);
  const startingRef = useRef(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const verifyToken = useCallback(async (raw) => {
    const token = extractQrToken(raw);
    if (!token) {
      setError("Could not read a verification code from that scan.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const booking = await getBookingByQrToken(token);
      setResult(booking);
    } catch (err) {
      setResult(null);
      setError(err.message || "Booking not found or not yet confirmed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(
    async (deviceId = selectedCameraId) => {
      if (startingRef.current) return;
      startingRef.current = true;
      setCameraError(null);
      setError(null);

      await stopScanner();

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(SCANNER_ID);
      }

      const onScan = (decodedText) => {
        verifyToken(decodedText);
        stopScanner();
      };

      const configs = buildCameraConfigs(deviceId);
      let lastError = null;

      for (const config of configs) {
        try {
          await scannerRef.current.start(config, SCANNER_CONFIG, onScan, () => {});
          setScanning(true);
          startingRef.current = false;
          return;
        } catch (err) {
          lastError = err;
          if (scannerRef.current?.isScanning) {
            try {
              await scannerRef.current.stop();
            } catch {
              /* ignore */
            }
          }
        }
      }

      setCameraError(
        lastError?.message ||
          "Could not access a camera. Allow browser permission, pick a device below, or enter the code manually."
      );
      setScanning(false);
      startingRef.current = false;
    },
    [selectedCameraId, stopScanner, verifyToken]
  );

  useEffect(() => {
    let cancelled = false;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return;
        setCameras(devices);
        if (devices.length === 0) {
          setCameraError("No camera detected. Connect a webcam or use manual entry below.");
          return;
        }
        const defaultId = pickDefaultCamera(devices);
        setSelectedCameraId(defaultId);
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError("Could not list cameras. You may still try Start camera or enter a code manually.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCameraId || cameras.length === 0) return;
    startScanner(selectedCameraId);
    return () => {
      stopScanner();
    };
  }, [selectedCameraId, cameras.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCameraChange = async (e) => {
    const id = e.target.value;
    setSelectedCameraId(id);
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#A98B75]/15 text-[#A98B75] mb-4">
            <FaQrcode size={22} />
          </div>
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">QR Scanner</h1>
          <p className="mt-2 text-gray-500">
            Scan a client&apos;s booking QR using your phone, laptop webcam, or external USB camera.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 shadow-sm mb-6">
          {cameras.length > 0 && (
            <div className="mb-4 max-w-sm mx-auto">
              <label className="flex items-center justify-center gap-2 text-sm font-medium text-[#5B4636] mb-2">
                <FaVideo className="text-[#A98B75]" size={14} /> Select camera
              </label>
              <select
                value={selectedCameraId}
                onChange={handleCameraChange}
                className="w-full border border-[#E8E1DA] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#A98B75] bg-white"
              >
                {cameras.map((cam, i) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label?.trim() || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Laptop built-in, external webcam, and phone cameras appear here when connected.
              </p>
            </div>
          )}

          <div
            id={SCANNER_ID}
            className="w-full max-w-lg mx-auto rounded-2xl overflow-hidden bg-[#F8F6F3] min-h-[300px]"
          />

          {cameraError && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mt-4 text-center">
              {cameraError}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {scanning ? (
              <button
                type="button"
                onClick={stopScanner}
                className="px-5 py-2.5 rounded-xl border border-[#E8E1DA] text-sm font-medium hover:bg-[#F8F6F3]"
              >
                Stop camera
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startScanner(selectedCameraId)}
                className="px-5 py-2.5 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260]"
              >
                Start camera
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 shadow-sm mb-6">
          <label className="block text-sm font-medium text-[#5B4636] mb-2 text-center">Or enter verification code</label>
          <div className="flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste code or verify URL"
              className="flex-1 border border-[#E8E1DA] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#A98B75]"
            />
            <button
              type="button"
              onClick={() => verifyToken(manualToken)}
              disabled={loading || !manualToken.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#5B4636] text-white text-sm font-medium disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        </div>

        {loading && <p className="text-center text-gray-500 text-sm">Verifying booking...</p>}

        {error && !loading && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <FaExclamationTriangle className="text-red-500 mx-auto mb-2" size={24} />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {result && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <FaCheckCircle className="text-green-600 mx-auto mb-3" size={32} />
            <h2 className="heading-serif text-xl font-bold text-[#5B4636]">Valid booking verified</h2>
            <p className="text-sm text-green-700 mt-1">This is a genuine confirmed Studio 8Teen booking.</p>

            <div className="mt-6 bg-white rounded-xl border border-green-100 p-4 text-left text-sm space-y-2">
              <p><span className="text-gray-400">Client:</span> <strong>{result.profiles?.full_name}</strong></p>
              <p><span className="text-gray-400">Package:</span> {result.packages?.name}</p>
              <p><span className="text-gray-400">Date:</span> {result.event_date} at {result.time_slot}</p>
              <p><span className="text-gray-400">Location:</span> {result.location || "Studio"}</p>
              <p><span className="text-gray-400">Status:</span> <span className="capitalize">{result.status.replace(/_/g, " ")}</span></p>
            </div>

            <Link
              to={`/admin/bookings/${result.id}`}
              className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260]"
            >
              View booking details
            </Link>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
