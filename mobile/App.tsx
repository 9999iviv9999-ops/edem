import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BottomTabs } from "./src/components/BottomTabs";
import {
  apiRequest,
  clearSession,
  getCurrentAuthPhone,
  hydrateSessionFromStorage,
  persistSession,
  setAuthExpiredHandler,
  setCurrentAuthPhone
} from "./src/api";
import { isVipPhone, normalizePhone, vipConfig } from "./src/config";
import { MessagesScreen } from "./src/screens/BidsScreen";
import { FeedScreen } from "./src/screens/MarketplaceScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SafetyScreen } from "./src/screens/SafetyScreen";
import { TabKey } from "./src/types";

const BUILD_MARKER = "MOBILE V2.1 BUILD v30";
const TOP_INSET = Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 0) : 0;
const TAB_SAFE_BOTTOM = Platform.OS === "android" ? 28 : 14;
const TAB_CONTENT_PADDING = 86 + TAB_SAFE_BOTTOM;

type AuthMode = "login" | "register";

export default function App() {
  const [tab, setTab] = useState<TabKey>("feed");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState("");
  const [isVipAccount, setIsVipAccount] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regAge, setRegAge] = useState("22");
  const [regGender, setRegGender] = useState<"male" | "female" | "other">("male");
  const [regCity, setRegCity] = useState("Москва");
  const [pendingChatMatchId, setPendingChatMatchId] = useState<string | null>(null);

  const goToChatWithMatch = useCallback((matchId: string) => {
    setPendingChatMatchId(matchId);
    setTab("messages");
  }, []);

  const clearPendingChatMatch = useCallback(() => {
    setPendingChatMatchId(null);
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await hydrateSessionFromStorage();
      const authPhone = await getCurrentAuthPhone();
      setIsVipAccount(isVipPhone(authPhone));
      setIsAuthorized(Boolean(session.accessToken && session.refreshToken));
      setLoadingSession(false);
    })();
  }, []);

  useEffect(() => {
    setAuthExpiredHandler(() => {
      setIsAuthorized(false);
      setTab("feed");
      setAuthError("Сессия истекла. Войди снова.");
    });
    return () => {
      setAuthExpiredHandler(null);
    };
  }, []);

  async function finishAuth(tokens: { accessToken: string; refreshToken: string }) {
    await persistSession(tokens.accessToken, tokens.refreshToken);
    setIsAuthorized(true);
    setAuthError("");
  }

  async function onLogin() {
    if (authBusy) return;
    if (password.length < 6) {
      setAuthError("Пароль не короче 6 символов");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    try {
      const trimmed = phone.trim();
      const body =
        trimmed.includes("@") ?
          { email: trimmed.toLowerCase(), password }
        : { phone: normalizePhone(trimmed), password };
      if (!trimmed.includes("@") && !(body as { phone: string }).phone) {
        setAuthError("Введи номер или email");
        setAuthBusy(false);
        return;
      }
      const data = await apiRequest<{ accessToken: string; refreshToken: string }>("/api/auth/login", {
        method: "POST",
        body,
        requireAuth: false
      });
      await finishAuth(data);
      try {
        const me = await apiRequest<{ phone?: string }>("/api/profiles/me");
        const p = me?.phone?.trim();
        if (p) {
          await setCurrentAuthPhone(p);
          setIsVipAccount(isVipPhone(p));
        } else {
          await setCurrentAuthPhone("");
          setIsVipAccount(false);
        }
      } catch {
        await setCurrentAuthPhone(trimmed.includes("@") ? "" : normalizePhone(trimmed));
        setIsVipAccount(!trimmed.includes("@") && isVipPhone(normalizePhone(trimmed)));
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setAuthBusy(false);
    }
  }

  async function onRegister() {
    if (authBusy) return;
    const normalized = normalizePhone(phone);
    const ageNum = Number(regAge);
    if (!regName.trim()) {
      setAuthError("Введи имя");
      return;
    }
    if (!normalized || password.length < 6) {
      setAuthError("Введи номер и пароль");
      return;
    }
    if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 80) {
      setAuthError("Возраст должен быть от 18 до 80");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    try {
      const data = await apiRequest<{ accessToken: string; refreshToken: string }>("/api/auth/register", {
        method: "POST",
        body: {
          email: `${normalized.replace(/\D+/g, "")}@phone.local`,
          phone: normalized,
          password,
          name: regName.trim(),
          age: ageNum,
          gender: regGender,
          city: regCity
        },
        requireAuth: false
      });
      await setCurrentAuthPhone(normalized);
      setIsVipAccount(isVipPhone(normalized));
      await finishAuth(data);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Ошибка регистрации");
    } finally {
      setAuthBusy(false);
    }
  }

  async function onLogout() {
    await clearSession();
    setIsAuthorized(false);
    setTab("feed");
  }

  const content = useMemo(() => {
    if (tab === "feed") return <FeedScreen onNavigateToChat={goToChatWithMatch} />;
    if (tab === "messages")
      return <MessagesScreen openMatchId={pendingChatMatchId} onOpenMatchConsumed={clearPendingChatMatch} />;
    if (tab === "safety") return <SafetyScreen />;
    return <ProfileScreen onLogout={() => void onLogout()} />;
  }, [tab, pendingChatMatchId, goToChatWithMatch, clearPendingChatMatch]);

  if (loadingSession) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Загрузка ЭДЕМ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthorized) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.authWrap} keyboardShouldPersistTaps="handled">
            <View style={styles.authCard}>
              <View style={styles.authLogoWrap}>
                <Image
                  source={require("./assets/icon.jpg")}
                  style={styles.authLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.authTitle}>ЭДЕМ</Text>
              <Text style={styles.buildMarker}>{BUILD_MARKER}</Text>

              <View style={styles.modeRow}>
                <Pressable style={[styles.modeBtn, authMode === "login" && styles.modeBtnActive]} onPress={() => setAuthMode("login")}>
                  <Text style={[styles.modeBtnText, authMode === "login" && styles.modeBtnTextActive]}>Вход</Text>
                </Pressable>
                <Pressable style={[styles.modeBtn, authMode === "register" && styles.modeBtnActive]} onPress={() => setAuthMode("register")}>
                  <Text style={[styles.modeBtnText, authMode === "register" && styles.modeBtnTextActive]}>Регистрация</Text>
                </Pressable>
              </View>

              {authMode === "register" ? (
                <>
                  <TextInput style={styles.input} placeholder="Имя" placeholderTextColor="#7f93bd" value={regName} onChangeText={setRegName} />
                  <TextInput
                    style={styles.input}
                    placeholder="Возраст (18-80)"
                    placeholderTextColor="#7f93bd"
                    keyboardType="number-pad"
                    value={regAge}
                    onChangeText={setRegAge}
                  />
                  <View style={styles.genderRow}>
                    <Pressable style={[styles.genderBtn, regGender === "male" && styles.genderBtnActive]} onPress={() => setRegGender("male")}>
                      <Text style={styles.genderText}>М</Text>
                    </Pressable>
                    <Pressable style={[styles.genderBtn, regGender === "female" && styles.genderBtnActive]} onPress={() => setRegGender("female")}>
                      <Text style={styles.genderText}>Ж</Text>
                    </Pressable>
                    <Pressable style={[styles.genderBtn, regGender === "other" && styles.genderBtnActive]} onPress={() => setRegGender("other")}>
                      <Text style={styles.genderText}>Др</Text>
                    </Pressable>
                  </View>
                  <TextInput style={styles.input} placeholder="Город" placeholderTextColor="#7f93bd" value={regCity} onChangeText={setRegCity} />
                </>
              ) : null}

              <TextInput style={styles.input} placeholder="+79991234567" placeholderTextColor="#7f93bd" value={phone} onChangeText={setPhone} />
              <TextInput
                style={styles.input}
                placeholder="Пароль"
                placeholderTextColor="#7f93bd"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {authError ? <Text style={styles.error}>{authError}</Text> : null}
              <Pressable
                style={[styles.loginBtn, authBusy && styles.loginBtnDisabled]}
                onPress={() => void (authMode === "login" ? onLogin() : onRegister())}
                disabled={authBusy}
              >
                <Text style={styles.loginBtnText}>
                  {authBusy ? "Подождите..." : authMode === "login" ? "Войти" : "Создать аккаунт"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.brandHeader}>
        <View style={styles.brandMarkWrap}>
          <Image source={require("./assets/icon.jpg")} style={styles.brandMarkImg} />
        </View>
        <View>
          <Text style={styles.brandHeaderText}>ЭДЕМ</Text>
          {isVipAccount ? <Text style={styles.vipBadgeHeader}>{vipConfig.status}</Text> : null}
        </View>
        <Text style={styles.buildMarkerHeader}>{BUILD_MARKER}</Text>
      </View>
      <View style={styles.releaseBanner}>
        <Text style={styles.releaseBannerText}>v30 — вход только по номеру</Text>
      </View>
      <View style={[styles.container, { paddingBottom: TAB_CONTENT_PADDING }]}>{content}</View>
      <View style={styles.tabsContainer}>
        <BottomTabs active={tab} onChange={setTab} />
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#090f1a",
  },
  container: {
    flex: 1,
  },
  tabsContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 50,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: {
    color: "#dce8ff",
    fontSize: 16,
    fontWeight: "600"
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: TOP_INSET + 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#243553",
    backgroundColor: "#0c1424"
  },
  brandMarkWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#5f79ae",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(111,141,255,0.2)"
  },
  brandMarkImg: {
    width: 22,
    height: 22,
    borderRadius: 7,
  },
  brandHeaderText: {
    color: "#f4f7ff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1
  },
  vipBadgeHeader: {
    color: "#f0cf7a",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 1,
    textTransform: "uppercase"
  },
  buildMarkerHeader: {
    marginLeft: "auto",
    color: "#9fb7e4",
    fontSize: 10,
    fontWeight: "700"
  },
  releaseBanner: {
    backgroundColor: "#314b8c",
    borderBottomWidth: 1,
    borderBottomColor: "#6f8dff",
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  releaseBannerText: {
    color: "#f4f7ff",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.4
  },
  authCard: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a3f63",
    backgroundColor: "#132138",
    gap: 10
  },
  authWrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 20
  },
  authTitle: {
    color: "#f4f7ff",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 1
  },
  authLogoWrap: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#5f79ae",
    overflow: "hidden",
    backgroundColor: "#0f1a2d",
    alignItems: "center",
    justifyContent: "center"
  },
  authLogo: {
    width: "92%",
    height: "92%"
  },
  buildMarker: {
    color: "#9fb7e4",
    fontSize: 12,
    fontWeight: "700"
  },
  authSub: {
    color: "#9fb1d7",
    marginBottom: 8
  },
  modeRow: {
    flexDirection: "row",
    gap: 8
  },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#0f1a2d"
  },
  modeBtnActive: {
    backgroundColor: "#314b8c",
    borderColor: "#6f8dff"
  },
  modeBtnText: {
    color: "#9fb1d7",
    fontWeight: "700"
  },
  modeBtnTextActive: {
    color: "#f4f7ff"
  },
  genderRow: {
    flexDirection: "row",
    gap: 8
  },
  genderBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 10,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f1a2d"
  },
  genderBtnActive: {
    backgroundColor: "#314b8c",
    borderColor: "#6f8dff"
  },
  genderText: {
    color: "#dce8ff",
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#f4f7ff",
    backgroundColor: "#0f1a2d"
  },
  error: {
    color: "#f3a7a7"
  },
  loginBtn: {
    marginTop: 6,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: "#5877cd",
    alignItems: "center"
  },
  loginBtnDisabled: {
    opacity: 0.7
  },
  loginBtnText: {
    color: "#f4f7ff",
    fontWeight: "700"
  }
});
