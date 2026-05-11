import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SearchablePickerModal } from "../components/SearchablePickerModal";
import { apiRequest, getCurrentAuthPhone, uploadProfilePhoto } from "../api";
import { appConfig, isVipPhone, vipConfig } from "../config";
import { TRAINER_SPECIALIZATIONS } from "../lib/trainerSpecializations";

type CatalogGym = { id: string; name: string; city: string; chainName?: string | null; address?: string | null };

type Props = {
  onLogout: () => void;
};

const MAX_PHOTOS = 6;

function photoDisplayUrl(path: string) {
  const p = (path || "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${appConfig.apiUrl}${p.startsWith("/") ? "" : "/"}${p}`;
}

export function ProfileScreen({ onLogout }: Props) {
  const [me, setMe] = useState<{
    name: string;
    age: number;
    gender: string;
    city: string;
    profileBadge?: string | null;
    inGym?: boolean;
    inGymAt?: string | null;
    inGymMinutes?: number;
    description?: string | null;
    photos: string[];
    goals: Array<{ goal: "relationship" | "communication" | "workout_partner" }>;
    trainingSlots: Array<{ slot: "morning" | "day" | "evening" | "weekends" }>;
    trainingTypes: Array<{ type: "strength" | "cardio" | "crossfit" | "yoga" }>;
    memberships: Array<{ gymId: string; isPrimary: boolean; gym: { id: string; name: string } }>;
    isTrainer?: boolean;
    trainerHeadline?: string | null;
    trainerBio?: string | null;
    trainerExperienceYears?: number | null;
    trainerSpecializations?: string[];
    trainerFormats?: string[];
    trainerPriceFrom?: number | null;
    trainerContacts?: string | null;
  } | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPrimaryGymId, setSelectedPrimaryGymId] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const [catalogGyms, setCatalogGyms] = useState<CatalogGym[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [gymsLoading, setGymsLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [isVipAccount, setIsVipAccount] = useState(false);
  const [inGymSaving, setInGymSaving] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
  const [trainerHeadline, setTrainerHeadline] = useState("");
  const [trainerBio, setTrainerBio] = useState("");
  const [trainerExperienceYears, setTrainerExperienceYears] = useState("");
  const [trainerSpecializations, setTrainerSpecializations] = useState<string[]>([]);
  const [trainerFormats, setTrainerFormats] = useState("");
  const [trainerPriceFrom, setTrainerPriceFrom] = useState("");
  const [trainerContacts, setTrainerContacts] = useState("");

  const cityPickerItems = useMemo(() => cities.map((c) => ({ id: c, label: c })), [cities]);

  async function loadCatalogForCity(cityName: string, preferredGymId?: string) {
    const c = cityName.trim() || "Москва";
    setGymsLoading(true);
    try {
      const gyms = await apiRequest<CatalogGym[]>(`/api/gyms?city=${encodeURIComponent(c)}`);
      let list = Array.isArray(gyms) ? gyms : [];
      if (preferredGymId && !list.some((g) => g.id === preferredGymId)) {
        try {
          const extra = await apiRequest<CatalogGym>(`/api/gyms/${preferredGymId}`);
          if (extra?.id) list = [extra, ...list];
        } catch {
          /* ignore */
        }
      }
      setCatalogGyms(list);
      const ids = new Set(list.map((g) => g.id));
      let next = "";
      if (preferredGymId && ids.has(preferredGymId)) next = preferredGymId;
      else if (list[0]) next = list[0].id;
      setSelectedPrimaryGymId(next);
    } catch {
      setCatalogGyms([]);
      setSelectedPrimaryGymId("");
    } finally {
      setGymsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const authPhone = await getCurrentAuthPhone();
        if (active) setIsVipAccount(isVipPhone(authPhone));
        let cityList: string[] = [];
        try {
          cityList = await apiRequest<string[]>("/api/gyms/cities");
        } catch {
          const all = await apiRequest<CatalogGym[]>("/api/gyms?limit=5000");
          cityList = Array.from(new Set((all || []).map((g) => g.city).filter(Boolean))).sort((a, b) =>
            a.localeCompare(b, "ru")
          );
        }
        if (!active) return;
        setCities(cityList);

        const profile = await apiRequest<{
          name: string;
          age: number;
          gender: string;
          city: string;
          profileBadge?: string | null;
          inGym?: boolean;
          inGymAt?: string | null;
          inGymMinutes?: number;
          description?: string | null;
          photos: string[];
          goals: Array<{ goal: "relationship" | "communication" | "workout_partner" }>;
          trainingSlots: Array<{ slot: "morning" | "day" | "evening" | "weekends" }>;
          trainingTypes: Array<{ type: "strength" | "cardio" | "crossfit" | "yoga" }>;
          memberships: Array<{ gymId: string; isPrimary: boolean; gym: { id: string; name: string } }>;
          isTrainer?: boolean;
          trainerHeadline?: string | null;
          trainerBio?: string | null;
          trainerExperienceYears?: number | null;
          trainerSpecializations?: string[];
          trainerFormats?: string[];
          trainerPriceFrom?: number | null;
          trainerContacts?: string | null;
        }>("/api/profiles/me");
        if (!active) return;
        setMe(profile);
        setPhotos(Array.isArray(profile.photos) ? profile.photos : []);
        setName(profile.name || "Профиль");
        const profileCity = (profile.city || "Москва").trim();
        const cityToUse = cityList.includes(profileCity) ? profileCity : cityList[0] || profileCity;
        setCity(cityToUse);
        setDescription(profile.description || "");
        const primaryId = profile.memberships.find((m) => m.isPrimary)?.gymId;
        await loadCatalogForCity(cityToUse, primaryId);
        setIsTrainer(Boolean(profile.isTrainer));
        setTrainerHeadline(profile.trainerHeadline || "");
        setTrainerBio(profile.trainerBio || "");
        setTrainerExperienceYears(
          typeof profile.trainerExperienceYears === "number" ? String(profile.trainerExperienceYears) : ""
        );
        setTrainerSpecializations(Array.isArray(profile.trainerSpecializations) ? profile.trainerSpecializations : []);
        setTrainerFormats(Array.isArray(profile.trainerFormats) ? profile.trainerFormats.join(", ") : "");
        setTrainerPriceFrom(typeof profile.trainerPriceFrom === "number" ? String(profile.trainerPriceFrom) : "");
        setTrainerContacts(profile.trainerContacts || "");
        if (!active) return;
        setLoadError("");
      } catch {
        if (!active) return;
        setLoadError("Не удалось загрузить профиль");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onCityPicked(nextCity: string) {
    if (!nextCity || nextCity === city) {
      setCityModalOpen(false);
      return;
    }
    setStatus("");
    try {
      await apiRequest("/api/profiles/me/location", {
        method: "PATCH",
        body: { city: nextCity, okrug: "", district: "" }
      });
    } catch {
      /* city still updated locally; user can save */
    }
    setCity(nextCity);
    await loadCatalogForCity(nextCity, undefined);
    setCityModalOpen(false);
  }

  async function persistPhotos(next: string[]) {
    await apiRequest("/api/profiles/me/photos", {
      method: "PATCH",
      body: { photos: next }
    });
    setPhotos(next);
    setMe((m) => (m ? { ...m, photos: next } : m));
  }

  async function addPhoto() {
    if (photos.length >= MAX_PHOTOS) {
      setStatus(`Можно не больше ${MAX_PHOTOS} фото`);
      return;
    }
    setStatus("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setStatus("Нужен доступ к галерее (настройки приложения).");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const mime = asset.mimeType || "image/jpeg";
    const name = uri.split("/").pop()?.split("?")[0] || "photo.jpg";
    setPhotoBusy(true);
    try {
      const url = await uploadProfilePhoto(uri, mime, name);
      await persistPhotos([...photos, url]);
      setStatus("Фото добавлено");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(url: string) {
    setStatus("");
    setPhotoBusy(true);
    try {
      const next = photos.filter((p) => p !== url);
      await persistPhotos(next);
      setStatus("Фото удалено");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveProfile() {
    if (!me) {
      setStatus("Профиль пока не загружен");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      await apiRequest("/api/profiles/me/basic", {
        method: "PATCH",
        body: {
          name: name.trim() || me.name,
          city: city.trim() || me.city,
          description: description.trim(),
          primaryGymId: selectedPrimaryGymId || undefined
        }
      });
      await apiRequest("/api/profiles/me/trainer", {
        method: "PATCH",
        body: {
          isTrainer,
          trainerHeadline,
          trainerBio,
          trainerExperienceYears: trainerExperienceYears ? Number(trainerExperienceYears) : null,
          trainerSpecializations,
          trainerFormats: trainerFormats
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          trainerPriceFrom: trainerPriceFrom ? Number(trainerPriceFrom) : null,
          trainerContacts
        }
      });
      setStatus("Профиль сохранен");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Не удалось сохранить профиль");
    } finally {
      setSaving(false);
    }
  }

  async function toggleInGym() {
    if (!me || inGymSaving) return;
    const next = !Boolean(me.inGym);
    setInGymSaving(true);
    setStatus("");
    try {
      const data = await apiRequest<{
        inGym?: boolean;
        inGymAt?: string | null;
        inGymMinutes?: number;
      }>("/api/profiles/me/in-gym", {
        method: "PATCH",
        body: { inGym: next }
      });
      setMe((m) =>
        m
          ? {
              ...m,
              inGym: Boolean(data.inGym),
              inGymAt: data.inGymAt || null,
              inGymMinutes: Number.isFinite(data.inGymMinutes) ? Number(data.inGymMinutes) : 0
            }
          : m
      );
      setStatus(next ? "Статус «Я в зале» включен" : "Статус «Я в зале» выключен");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Не удалось обновить статус");
    } finally {
      setInGymSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Профиль</Text>
      {me?.profileBadge || isVipAccount ? (
        <View style={styles.vipCard}>
          <Text style={styles.vipTitle}>{me?.profileBadge?.trim() || vipConfig.status}</Text>
        </View>
      ) : null}
      {loadError ? <Text style={styles.text}>{loadError}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Основное</Text>
        <View style={styles.inGymRow}>
          <Text style={[styles.inGymChip, me?.inGym ? styles.inGymChipActive : null]}>
            {me?.inGym
              ? me?.inGymMinutes
                ? `Я в зале ${me.inGymMinutes} мин`
                : "Я в зале сейчас"
              : "Не в зале"}
          </Text>
          <Pressable
            style={[styles.btn, inGymSaving && styles.btnDisabled]}
            onPress={() => void toggleInGym()}
            disabled={inGymSaving}
          >
            <Text style={styles.btnText}>
              {inGymSaving ? "Сохраняем..." : me?.inGym ? "Выйти из статуса" : "Я в зале"}
            </Text>
          </Pressable>
        </View>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Имя" placeholderTextColor="#7f93bd" />
        <Text style={styles.fieldLabel}>Город</Text>
        <Pressable style={styles.selectRow} onPress={() => setCityModalOpen(true)}>
          <Text style={styles.selectValue} numberOfLines={1}>
            {city || "Выбери город"}
          </Text>
          <Text style={styles.selectChevron}>▼</Text>
        </Pressable>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="О себе"
          placeholderTextColor="#7f93bd"
          multiline
          maxLength={500}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Фото в профиле</Text>
        <Text style={styles.text}>До {MAX_PHOTOS} снимков, как на сайте. Сохраняются сразу на сервер.</Text>
        <View style={styles.photoGrid}>
          {photos.map((p) => (
            <View key={p} style={styles.photoTile}>
              <Image source={{ uri: photoDisplayUrl(p) }} style={styles.photoImg} />
              <Pressable style={styles.photoRemove} onPress={() => void removePhoto(p)} disabled={photoBusy}>
                <Text style={styles.photoRemoveText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <Pressable
          style={[styles.addPhotoBtn, (photoBusy || photos.length >= MAX_PHOTOS) && styles.btnDisabled]}
          onPress={() => void addPhoto()}
          disabled={photoBusy || photos.length >= MAX_PHOTOS}
        >
          {photoBusy ? (
            <ActivityIndicator color="#f4f7ff" />
          ) : (
            <Text style={styles.addPhotoBtnText}>{photos.length >= MAX_PHOTOS ? "Лимит фото" : "Добавить фото"}</Text>
          )}
        </Pressable>
      </View>

      <SearchablePickerModal
        visible={cityModalOpen}
        title="Город"
        items={cityPickerItems}
        onClose={() => setCityModalOpen(false)}
        onSelect={(id) => void onCityPicked(id)}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Основной зал ({city.trim() || "город"})</Text>
        <Text style={styles.text}>Список залов каталога для выбранного города. Нажми зал, затем «Сохранить».</Text>
        {gymsLoading ? <Text style={styles.text}>Загрузка залов...</Text> : null}
        {catalogGyms.map((g) => (
          <Pressable
            key={g.id}
            style={[styles.gymBtn, selectedPrimaryGymId === g.id && styles.gymBtnActive]}
            onPress={() => setSelectedPrimaryGymId(g.id)}
          >
            <Text style={[styles.gymText, selectedPrimaryGymId === g.id && styles.gymTextActive]}>
              {[g.chainName, g.name, g.address].filter((x) => (x || "").trim()).join(" · ")}
              {selectedPrimaryGymId === g.id ? " (основной)" : ""}
            </Text>
          </Pressable>
        ))}
        {!gymsLoading && catalogGyms.length === 0 ? (
          <Text style={styles.text}>В этом городе нет залов в каталоге. Выбери другой город.</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Действия</Text>
        <Text style={styles.cardTitle}>Режим тренера</Text>
        <Pressable style={[styles.btn, isTrainer && styles.gymBtnActive]} onPress={() => setIsTrainer((v) => !v)}>
          <Text style={styles.btnText}>{isTrainer ? "Режим тренера включен" : "Включить режим тренера"}</Text>
        </Pressable>
        {isTrainer ? (
          <>
            <TextInput
              style={styles.input}
              value={trainerHeadline}
              onChangeText={setTrainerHeadline}
              placeholder="Краткий оффер"
              placeholderTextColor="#7f93bd"
            />
            <TextInput
              style={styles.input}
              value={trainerExperienceYears}
              onChangeText={setTrainerExperienceYears}
              placeholder="Стаж (лет)"
              placeholderTextColor="#7f93bd"
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.input}
              value={trainerPriceFrom}
              onChangeText={setTrainerPriceFrom}
              placeholder="Цена от (руб)"
              placeholderTextColor="#7f93bd"
              keyboardType="number-pad"
            />
            <Text style={styles.fieldLabel}>Специализации</Text>
            <View style={styles.tagsWrap}>
              {TRAINER_SPECIALIZATIONS.map((spec) => {
                const active = trainerSpecializations.includes(spec);
                return (
                  <Pressable
                    key={spec}
                    style={[styles.tagBtn, active && styles.tagBtnActive]}
                    onPress={() =>
                      setTrainerSpecializations((prev) =>
                        prev.includes(spec) ? prev.filter((item) => item !== spec) : [...prev, spec]
                      )
                    }
                  >
                    <Text style={[styles.tagText, active && styles.tagTextActive]}>{spec}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              value={trainerFormats}
              onChangeText={setTrainerFormats}
              placeholder="Форматы через запятую"
              placeholderTextColor="#7f93bd"
            />
            <TextInput
              style={styles.input}
              value={trainerContacts}
              onChangeText={setTrainerContacts}
              placeholder="Контакты для записи"
              placeholderTextColor="#7f93bd"
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={trainerBio}
              onChangeText={setTrainerBio}
              placeholder="О тренерских услугах"
              placeholderTextColor="#7f93bd"
              multiline
            />
          </>
        ) : null}
        <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={() => void saveProfile()} disabled={saving}>
          <Text style={styles.btnText}>{saving ? "Сохраняем..." : "Сохранить профиль"}</Text>
        </Pressable>
        {status ? <Text style={styles.text}>{status}</Text> : null}
      </View>

      <Pressable style={styles.btn} onPress={onLogout}>
        <Text style={styles.btnText}>Выйти</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 96,
    gap: 10,
    backgroundColor: "#0a1220"
  },
  title: {
    color: "#f4f7ff",
    fontWeight: "700",
    fontSize: 22
  },
  vipCard: {
    borderWidth: 1,
    borderColor: "#c79b38",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#1d1626",
    shadowColor: "#c79b38",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  vipTitle: {
    color: "#ffe2a9",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center"
  },
  card: {
    backgroundColor: "#132138",
    borderColor: "#2a3f63",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8
  },
  cardTitle: {
    color: "#f4f7ff",
    fontWeight: "700"
  },
  inGymRow: {
    gap: 8
  },
  inGymChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#5f79ae",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    color: "#c8d8ff",
    fontWeight: "700",
    fontSize: 12
  },
  inGymChipActive: {
    borderColor: "#2ed28a",
    color: "#b5ffd2",
    backgroundColor: "#13392c"
  },
  text: {
    color: "#d6e2ff"
  },
  fieldLabel: {
    color: "#9fb1d7",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4
  },
  input: {
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#f4f7ff",
    backgroundColor: "#0f1a2d"
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#0f1a2d",
    gap: 8
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
  gymBtn: {
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#0f1a2d"
  },
  gymBtnActive: {
    borderColor: "#6f8dff",
    backgroundColor: "#314b8c"
  },
  gymText: {
    color: "#c8d8ff",
    fontWeight: "700"
  },
  gymTextActive: {
    color: "#f4f7ff"
  },
  btn: {
    borderColor: "#5f79ae",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center"
  },
  btnText: {
    color: "#c8d8ff",
    fontWeight: "700"
  },
  btnDisabled: {
    opacity: 0.6
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  photoTile: {
    width: 96,
    height: 128,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2a3f63",
    position: "relative"
  },
  photoImg: {
    width: "100%",
    height: "100%"
  },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center"
  },
  photoRemoveText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginTop: -2
  },
  addPhotoBtn: {
    marginTop: 8,
    backgroundColor: "#314b8c",
    borderWidth: 1,
    borderColor: "#6f8dff",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center"
  },
  addPhotoBtnText: {
    color: "#f4f7ff",
    fontWeight: "700"
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tagBtn: {
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#0f1a2d"
  },
  tagBtnActive: {
    borderColor: "#6f8dff",
    backgroundColor: "#314b8c"
  },
  tagText: {
    color: "#c8d8ff",
    fontWeight: "600",
    fontSize: 12
  },
  tagTextActive: {
    color: "#f4f7ff"
  }
});
