import { View } from "react-native";
import UsersRound from "lucide-react-native/icons/users-round";
import { Screen } from "@/components/Screen";
import { Empty } from "@/components/ui";
import { useTheme } from "@/theme/useTheme";

export default function TogetherScreen() {
  const { c } = useTheme();
  return (
    <Screen title="Together">
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <Empty text="Everyone swipes on their phone, we find the movie you all agree on. Coming soon.">
          <UsersRound size={32} color={c.muted} />
        </Empty>
      </View>
    </Screen>
  );
}
