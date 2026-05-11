import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiRequest } from "../api";
import { normalizePhotoUrl } from "../lib/photo";

type Trainer = {
  id: string;
  name: string;
  age: number;
  city: string;
  photos: string[];
  trainerHeadline?: string | null;
  trainerExperienceYears?: number | null;
  trainerSpecializations?: string[];
  trainerPriceFrom?: number | null;
  trainerContacts?: string | null;
};

export function TrainersScreen() {
  const [list, setList] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const me = await apiRequest<{ city?: string }>("/api/profiles/me");
        const city = me?.city?.trim();
        const data = await apiRequest<Trainer[]>(
          `/api/trainers?limit=100${city ? `&city=${encodeURIComponent(city)}` : ""}`
        );
        if (!active) return;
        setList(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить тренеров");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Тренеры</Text>
      <Text style={styles.sub}>Выбери тренера и открой профиль, чтобы написать ему.</Text>
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator color="#6f8dff" />
          <Text style={styles.sub}>Загрузка...</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {list.map((t) => (
        <View key={t.id} style={styles.card}>
          {t.photos?.[0] ? (
            <Image source={{ uri: normalizePhotoUrl(t.photos[0]) }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imageEmpty]} />
          )}
          <View style={styles.body}>
            <Text style={styles.name}>
              {t.name}, {t.age}
            </Text>
            <Text style={styles.text}>{t.trainerHeadline || "Тренер в EDEM"}</Text>
            <Text style={styles.text}>
              {t.trainerExperienceYears ? `Стаж ${t.trainerExperienceYears} лет` : "Стаж не указан"}
            </Text>
            {t.trainerPriceFrom ? <Text style={styles.text}>Цена от {t.trainerPriceFrom} ₽</Text> : null}
            {t.trainerSpecializations?.length ? (
              <Text style={styles.text} numberOfLines={2}>
                {t.trainerSpecializations.join(" · ")}
              </Text>
            ) : null}
            {t.trainerContacts ? (
              <Text style={styles.text} numberOfLines={1}>
                {t.trainerContacts}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
      {!loading && !error && list.length === 0 ? (
        <Text style={styles.sub}>Пока нет тренеров. Попроси знакомого тренера включить режим "Я тренер".</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120, gap: 10, backgroundColor: "#0a1220" },
  title: { color: "#f4f7ff", fontSize: 22, fontWeight: "700" },
  sub: { color: "#9fb1d7" },
  error: { color: "#f3a7a7" },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  card: {
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#132138"
  },
  image: { width: "100%", height: 170, backgroundColor: "#0f1a2d" },
  imageEmpty: {},
  body: { padding: 12, gap: 6 },
  name: { color: "#f4f7ff", fontSize: 18, fontWeight: "700" },
  text: { color: "#d6e2ff", fontSize: 13 }
});

