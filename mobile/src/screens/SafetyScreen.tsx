import { ScrollView, StyleSheet, Text, View } from "react-native";

export function SafetyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Безопасность</Text>
      <Text style={styles.sub}>Короткие правила безопасных знакомств</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Первые встречи</Text>
        <Text style={styles.text}>Встречайся в общественных местах и сообщай близким, куда идешь.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Личные данные</Text>
        <Text style={styles.text}>Не отправляй документы, коды из SMS и данные банковских карт.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Жалобы</Text>
        <Text style={styles.text}>При подозрительном поведении используй жалобу и блокировку в приложении.</Text>
      </View>
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
  sub: {
    color: "#9fb1d7",
    fontSize: 14
  },
  card: {
    backgroundColor: "#132138",
    borderColor: "#2a3f63",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6
  },
  cardTitle: {
    color: "#f4f7ff",
    fontWeight: "700"
  },
  text: {
    color: "#d6e2ff"
  }
});
