import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { ProfileBadgeChip } from "../components/ProfileBadgeChip";
import { ProfileDetailModal } from "../components/ProfileDetailModal";
import { SearchablePickerModal } from "../components/SearchablePickerModal";
import { apiRequest } from "../api";
import { normalizePhotoUrl } from "../lib/photo";
import { FeedProfile } from "../types";

type CatalogGym = { id: string; name: string; city: string; chainName?: string | null };

function catalogGymLabel(g: CatalogGym) {
  const parts = [g.chainName, g.name].map((x) => (x || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : g.name;
}

const SNOOZE_KEY = "edem_snoozed_profiles_mobile";
const SNOOZE_MS = 48 * 60 * 60 * 1000;

async function readSnoozed(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_KEY);
    const o = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const now = Date.now();
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "number" && v > now) next[k] = v;
    }
    if (Object.keys(next).length !== Object.keys(o).length) {
      await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
    }
    return next;
  } catch {
    return {};
  }
}

async function snoozeUser(userId: string) {
  const map = await readSnoozed();
  map[userId] = Date.now() + SNOOZE_MS;
  await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
}

function applySnooze(list: FeedProfile[], snoozed: Record<string, number>): FeedProfile[] {
  const now = Date.now();
  return list.filter((p) => !snoozed[p.id] || snoozed[p.id] <= now);
}

type FeedScreenProps = {
  onNavigateToChat?: (matchId: string) => void;
};

export function FeedScreen({ onNavigateToChat }: FeedScreenProps) {
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [gyms, setGyms] = useState<CatalogGym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [profiles, setProfiles] = useState<FeedProfile[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [actionBusyId, setActionBusyId] = useState("");
  const [statusText, setStatusText] = useState("");
  const [gymSwitchBusy, setGymSwitchBusy] = useState(false);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [gymModalOpen, setGymModalOpen] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const cityPickerItems = useMemo(() => cities.map((c) => ({ id: c, label: c })), [cities]);
  const gymPickerItems = useMemo(
    () => gyms.map((g) => ({ id: g.id, label: catalogGymLabel(g) })),
    [gyms]
  );

  const persistLocation = useCallback(async (nextCity: string) => {
    await apiRequest("/api/profiles/me/location", {
      method: "PATCH",
      body: { city: nextCity, okrug: "", district: "" }
    });
  }, []);

  const loadGymsForCity = useCallback(async (cityName: string) => {
    const list = await apiRequest<CatalogGym[]>(`/api/gyms?city=${encodeURIComponent(cityName)}`);
    return Array.isArray(list) ? list : [];
  }, []);

  const applyPrimaryGym = useCallback(async (gymId: string) => {
    await apiRequest("/api/profiles/me/primary-gym", {
      method: "PATCH",
      body: { gymId }
    });
  }, []);

  const loadProfiles = useCallback(async (gymId: string) => {
    if (!gymId) return;
    setLoading(true);
    setError("");
    try {
      const list = await apiRequest<FeedProfile[]>(`/api/profiles/gyms/${gymId}`);
      const raw = Array.isArray(list) ? list : [];
      const snoozed = await readSnoozed();
      setProfiles(applySnooze(raw, snoozed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить ленту");
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setBooting(true);
      setError("");
      try {
        const profile = await apiRequest<{
          city: string;
          memberships: Array<{ gymId: string; isPrimary: boolean; gym: { id: string; name: string } }>;
        }>("/api/profiles/me");
        if (!active) return;

        let cityList: string[] = [];
        try {
          cityList = await apiRequest<string[]>("/api/gyms/cities");
        } catch {
          const all = await apiRequest<CatalogGym[]>("/api/gyms");
          cityList = Array.from(new Set((all || []).map((g) => g.city).filter(Boolean))).sort((a, b) =>
            a.localeCompare(b, "ru")
          );
        }
        if (!active) return;
        setCities(cityList);

        const profileCity = profile.city?.trim() || "Москва";
        const cityToUse = cityList.includes(profileCity) ? profileCity : cityList[0] || profileCity;
        if (cityToUse !== profileCity && cityList.length) {
          try {
            await persistLocation(cityToUse);
          } catch {
            /* keep UI usable */
          }
        }
        if (!active) return;
        setCity(cityToUse);

        const gymList = await loadGymsForCity(cityToUse);
        if (!active) return;
        setGyms(gymList);

        const gymIds = new Set(gymList.map((g) => g.id));
        const primaryId = profile.memberships?.find((m) => m.isPrimary)?.gymId;
        const firstMemberInCity = profile.memberships?.find((m) => gymIds.has(m.gymId))?.gymId;
        let initial =
          primaryId && gymIds.has(primaryId) ? primaryId : firstMemberInCity || gymList[0]?.id || "";

        if (!initial && gymList.length === 0) {
          setError("В этом городе пока нет залов в каталоге. Выбери другой город.");
          setSelectedGymId("");
          return;
        }

        if (initial && !gymIds.has(initial)) {
          initial = gymList[0]?.id || "";
        }

        if (initial) {
          try {
            await applyPrimaryGym(initial);
          } catch {
            /* still show feed; like may require membership */
          }
        }
        if (!active) return;
        setSelectedGymId(initial);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Не удалось открыть ленту");
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyPrimaryGym, loadGymsForCity, persistLocation]);

  useEffect(() => {
    if (!selectedGymId || booting) return;
    void loadProfiles(selectedGymId);
  }, [selectedGymId, booting, loadProfiles]);

  async function onCityPress(nextCity: string) {
    if (!nextCity || nextCity === city || gymSwitchBusy) return;
    setGymSwitchBusy(true);
    setStatusText("");
    setError("");
    try {
      await persistLocation(nextCity);
      setCity(nextCity);
      const gymList = await loadGymsForCity(nextCity);
      setGyms(gymList);
      const nextId = gymList[0]?.id || "";
      if (nextId) {
        await applyPrimaryGym(nextId);
        setSelectedGymId(nextId);
      } else {
        setSelectedGymId("");
        setProfiles([]);
        setError("В выбранном городе нет залов в каталоге.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сменить город");
    } finally {
      setGymSwitchBusy(false);
    }
  }

  async function onGymPress(gymId: string) {
    if (!gymId || gymId === selectedGymId || gymSwitchBusy) return;
    setGymSwitchBusy(true);
    setStatusText("");
    setError("");
    try {
      await applyPrimaryGym(gymId);
      setSelectedGymId(gymId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выбрать зал");
    } finally {
      setGymSwitchBusy(false);
    }
  }

  async function likeUser(userId: string) {
    if (!selectedGymId) return;
    try {
      setActionBusyId(userId);
      setStatusText("");
      await apiRequest("/api/likes", {
        method: "POST",
        body: { toUserId: userId, gymId: selectedGymId }
      });
      setProfiles((prev) => prev.filter((p) => p.id !== userId));
      setStatusText("Лайк отправлен");
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : "Не удалось поставить лайк");
    } finally {
      setActionBusyId("");
    }
  }

  async function openChat(userId: string) {
    if (!selectedGymId) return;
    try {
      setActionBusyId(userId);
      setStatusText("");
      const match = await apiRequest<{ id: string }>("/api/messages/start", {
        method: "POST",
        body: { toUserId: userId, gymId: selectedGymId }
      });
      setProfiles((prev) => prev.filter((p) => p.id !== userId));
      setStatusText("Открываем чат…");
      onNavigateToChat?.(match.id);
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : "Не удалось написать");
    } finally {
      setActionBusyId("");
    }
  }

  function hideUser(userId: string) {
    setProfiles((prev) => prev.filter((p) => p.id !== userId));
  }

  function moreMenu(userId: string) {
    Alert.alert("Ещё", undefined, [
      {
        text: "Позже (скрыть 48 ч)",
        onPress: () => {
          void (async () => {
            await snoozeUser(userId);
            hideUser(userId);
          })();
        }
      },
      {
        text: "Скрыть из ленты",
        style: "destructive",
        onPress: () => hideUser(userId)
      },
      { text: "Отмена", style: "cancel" }
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Лента</Text>

      {booting ? (
        <View style={styles.rowCenter}>
          <ActivityIndicator color="#6f8dff" />
          <Text style={styles.sub}>Загрузка...</Text>
        </View>
      ) : null}

      {cities.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Город</Text>
          <Pressable
            style={[styles.selectRow, gymSwitchBusy && styles.selectRowDisabled]}
            onPress={() => setCityModalOpen(true)}
            disabled={gymSwitchBusy}
          >
            <Text style={styles.selectValue} numberOfLines={1}>
              {city || "Выбери город"}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
        </View>
      ) : null}

      {gyms.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Зал</Text>
          <Pressable
            style={[styles.selectRow, gymSwitchBusy && styles.selectRowDisabled]}
            onPress={() => setGymModalOpen(true)}
            disabled={gymSwitchBusy}
          >
            <Text style={styles.selectValue} numberOfLines={2}>
              {(() => {
                const g = gyms.find((x) => x.id === selectedGymId);
                return g ? catalogGymLabel(g) : "Выбери зал";
              })()}
              {selectedGymId ? " · основной" : ""}
            </Text>
            <Text style={styles.selectChevron}>▼</Text>
          </Pressable>
        </View>
      ) : !booting ? (
        <Text style={styles.error}>Нет залов для выбранного города.</Text>
      ) : null}

      <SearchablePickerModal
        visible={cityModalOpen}
        title="Город"
        items={cityPickerItems}
        onClose={() => setCityModalOpen(false)}
        onSelect={(id) => void onCityPress(id)}
      />
      <SearchablePickerModal
        visible={gymModalOpen}
        title="Зал"
        items={gymPickerItems}
        onClose={() => setGymModalOpen(false)}
        onSelect={(id) => void onGymPress(id)}
      />

      <ProfileDetailModal
        visible={!!detailUserId}
        userId={detailUserId}
        gymId={selectedGymId}
        onClose={() => setDetailUserId(null)}
        onProfileRemoved={(uid) => setProfiles((p) => p.filter((x) => x.id !== uid))}
        onStartChat={(mid) => onNavigateToChat?.(mid)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {statusText ? <Text style={styles.statusOk}>{statusText}</Text> : null}
      {loading && !booting ? (
        <View style={styles.rowCenter}>
          <ActivityIndicator color="#6f8dff" />
          <Text style={styles.sub}>Загрузка анкет...</Text>
        </View>
      ) : null}

      {profiles.map((item) => {
        const photo = item.photos?.[0] ? normalizePhotoUrl(item.photos[0]) : "";
        const busy = actionBusyId === item.id;
        return (
          <View key={item.id} style={styles.card}>
            <Pressable onPress={() => setDetailUserId(item.id)} style={styles.cardPhotoWrap}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.cardPhoto} resizeMode="cover" />
              ) : (
                <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
                  <Ionicons name="person" size={48} color="#5f79ae" />
                </View>
              )}
            </Pressable>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>
                {item.name}, {item.age}
              </Text>
              <ProfileBadgeChip label={item.profileBadge} />
              {item.inGym ? (
                <Text style={styles.inGymNow}>
                  {item.inGymMinutes ? `В зале ${item.inGymMinutes} мин` : "Сейчас в зале"}
                </Text>
              ) : null}
              <Text style={styles.text} numberOfLines={3}>
                {item.description || "Открыт(а) к знакомству и тренировкам."}
              </Text>
              <View style={styles.iconRow}>
                <Pressable
                  style={[styles.circleBtn, styles.heartBtn, (!selectedGymId || busy) && styles.circleDisabled]}
                  disabled={!selectedGymId || busy}
                  onPress={() => void likeUser(item.id)}
                  accessibilityLabel="Лайк"
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="heart" size={26} color="#fff" />
                  )}
                </Pressable>
                <Pressable
                  style={[styles.circleBtn, styles.chatBtn, (!selectedGymId || busy) && styles.circleDisabled]}
                  disabled={!selectedGymId || busy}
                  onPress={() => void openChat(item.id)}
                  accessibilityLabel="Написать"
                >
                  <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
                </Pressable>
                <Pressable style={styles.circleBtnGhost} onPress={() => moreMenu(item.id)}>
                  <Ionicons name="ellipsis-horizontal" size={22} color="#c8d8ff" />
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}

      {!loading && !booting && selectedGymId && profiles.length === 0 && !error ? (
        <Text style={styles.sub}>Пока анкет в этом зале нет. Попробуй другой зал.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 130,
    gap: 12,
    backgroundColor: "#0a1220"
  },
  title: {
    color: "#f4f7ff",
    fontWeight: "700",
    fontSize: 22
  },
  sub: {
    color: "#9fb1d7",
    fontSize: 14
  },
  section: {
    gap: 8
  },
  sectionLabel: {
    color: "#c8d8ff",
    fontWeight: "700",
    fontSize: 13
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#0f1a2d",
    gap: 10
  },
  selectRowDisabled: {
    opacity: 0.55
  },
  selectValue: {
    flex: 1,
    color: "#f4f7ff",
    fontSize: 16,
    fontWeight: "600"
  },
  selectChevron: {
    color: "#6f8dff",
    fontSize: 12,
    fontWeight: "800"
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  error: {
    color: "#f3a7a7"
  },
  statusOk: {
    color: "#9dffb5",
    fontSize: 14
  },
  card: {
    backgroundColor: "#132138",
    borderColor: "#2a3f63",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden"
  },
  cardPhotoWrap: {
    position: "relative"
  },
  cardPhoto: {
    width: "100%",
    height: 200,
    backgroundColor: "#0f1a2d"
  },
  cardPhotoPlaceholder: {
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: {
    padding: 12,
    gap: 8
  },
  cardTitle: {
    color: "#f4f7ff",
    fontWeight: "700",
    fontSize: 18
  },
  text: {
    color: "#d6e2ff",
    fontSize: 14,
    lineHeight: 20
  },
  inGymNow: {
    color: "#b5ffd2",
    fontWeight: "700",
    fontSize: 12
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4
  },
  circleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center"
  },
  heartBtn: {
    backgroundColor: "#e2556d"
  },
  chatBtn: {
    backgroundColor: "#314b8c",
    borderWidth: 2,
    borderColor: "#6f8dff"
  },
  circleDisabled: {
    opacity: 0.5
  },
  circleBtnGhost: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#5f79ae",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto"
  }
});
