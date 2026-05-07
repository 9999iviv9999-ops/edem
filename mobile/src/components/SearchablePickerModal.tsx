import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

export type PickerItem = { id: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  items: PickerItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function SearchablePickerModal({ visible, title, items, onSelect, onClose }: Props) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => i.label.toLowerCase().includes(needle));
  }, [items, q]);

  const topPad = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 8 : 48;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Закрыть</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <TextInput
          style={styles.search}
          placeholder="Поиск..."
          placeholderTextColor="#7f93bd"
          value={q}
          onChangeText={setQ}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                onSelect(item.id);
                setQ("");
                onClose();
              }}
            >
              <Text style={styles.rowText}>{item.label}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Ничего не найдено</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#090f1a"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#243553"
  },
  headerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 72
  },
  headerBtnText: {
    color: "#6f8dff",
    fontWeight: "700",
    fontSize: 16
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#f4f7ff",
    fontWeight: "800",
    fontSize: 17
  },
  headerSpacer: {
    minWidth: 72
  },
  search: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f4f7ff",
    backgroundColor: "#0f1a2d",
    fontSize: 16
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 24
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#243553"
  },
  rowText: {
    color: "#dce8ff",
    fontSize: 16
  },
  empty: {
    color: "#9fb1d7",
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 24
  }
});
