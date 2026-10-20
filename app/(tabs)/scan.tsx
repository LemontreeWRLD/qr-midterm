import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

import AppButton from "@/components/AppButton";
import StateView from "@/components/StateView";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { registerAttendance, type RegisterResult } from "@/lib/attendance";
import { fmtDateTime } from "@/lib/format";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { user, role, profileLoading } = useAuth();

  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);
  // Guards against the camera firing several times for one QR
  const lock = useRef(false);

  // Fresh scanner every time the tab is opened
  useFocusEffect(
    useCallback(() => {
      reset();
    }, [])
  );

  function reset() {
    lock.current = false;
    setScanned(false);
    setProcessing(false);
    setResult(null);
  }

  if (profileLoading) return <StateView kind="loading" title="Checking your account..." />;

  // UNAUTHORIZED: only students record attendance
  if (role && role !== "student") {
    return (
      <StateView
        kind="locked"
        title="Students only"
        message="Only student accounts can record attendance. Teachers and administrators manage events instead."
      />
    );
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera Permission Needed</Text>
        <Text style={styles.subtitle}>
          We need access to your camera to scan QR codes.
        </Text>
        <AppButton
          theme="primary"
          title="Grant Permission"
          icon="camera"
          onPress={requestPermission}
        />
      </View>
    );
  }

  // EVENT: QR scanner detects a QR code -> handler -> validate + insert
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (lock.current) return;
    lock.current = true;
    setScanned(true);
    setProcessing(true);

    if (!user) {
      setResult({
        success: false,
        code: "unauthorized",
        message: "You are not signed in.",
      });
      setProcessing(false);
      return;
    }

    try {
      setResult(await registerAttendance(data, user.id));
    } catch {
      setResult({
        success: false,
        code: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const ok = result?.success === true;

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {!scanned && (
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
        </View>
      )}

      <View style={styles.overlay}>
        {!scanned && (
          <Text style={styles.overlayText}>Point your camera at the event QR code</Text>
        )}

        {processing && (
          <Text style={styles.overlayText}>Recording attendance...</Text>
        )}

        {result && !processing && (
          <>
            <Ionicons
              name={ok ? "checkmark-circle" : "close-circle"}
              size={48}
              color={ok ? COLORS.success : COLORS.danger}
            />
            <Text style={[styles.scanResult, ok ? styles.success : styles.error]}>
              {result.message}
            </Text>
            {result.eventTitle ? (
              <Text style={styles.eventTitle}>{result.eventTitle}</Text>
            ) : null}
            {ok && result.scannedAt ? (
              <Text style={styles.scanData}>{fmtDateTime(result.scannedAt)}</Text>
            ) : null}
            <View style={{ width: "100%", marginTop: 8 }}>
              <AppButton
                theme="primary"
                title="Scan Again"
                icon="refresh"
                onPress={reset}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  camera: { ...StyleSheet.absoluteFillObject },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 20,
    opacity: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  overlay: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 40,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  overlayText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  scanResult: { fontSize: 16, textAlign: "center", fontWeight: "700" },
  success: { color: "#2E7D32" },
  error: { color: "#C62828" },
  eventTitle: { fontSize: 14, color: COLORS.textPrimary, fontWeight: "600" },
  scanData: { fontSize: 12, color: COLORS.textSecondary, textAlign: "center" },
});
