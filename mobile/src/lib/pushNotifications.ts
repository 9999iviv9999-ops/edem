import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "../api";
import { easProjectId } from "../config";

const STORED_PUSH_TOKEN_KEY = "edem_expo_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function ensurePushRegistration(): Promise<void> {
  if (!Device.isDevice) {
    console.warn("[push] пропуск: не физическое устройство");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "ЭДЕМ",
      importance: Notifications.AndroidImportance.MAX
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    final = req.status;
  }
  if (final !== "granted") {
    console.warn("[push] нет разрешения на уведомления:", final);
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    easProjectId;

  let token: string;
  try {
    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenRes.data;
  } catch (e) {
    console.warn("[push] getExpoPushTokenAsync failed", e);
    return;
  }
  if (!token) {
    console.warn("[push] пустой push-токен");
    return;
  }

  try {
    await AsyncStorage.setItem(STORED_PUSH_TOKEN_KEY, token);
    await apiRequest("/api/push/devices", {
      method: "POST",
      body: {
        token,
        platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown"
      }
    });
    if (__DEV__) console.log("[push] токен зарегистрирован на сервере");
  } catch (e) {
    console.warn("[push] не удалось отправить токен на API", e);
  }
}

export async function unregisterPushDevice(): Promise<void> {
  const token = await AsyncStorage.getItem(STORED_PUSH_TOKEN_KEY);
  if (!token) return;
  try {
    await apiRequest("/api/push/devices", {
      method: "DELETE",
      body: { token }
    });
  } catch {
    /* ignore */
  }
  await AsyncStorage.removeItem(STORED_PUSH_TOKEN_KEY);
}
