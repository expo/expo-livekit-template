import { registerGlobals } from "@livekit/react-native";
import { setToolsButtonVisible } from "expo-dev-client";
registerGlobals();
if (__DEV__) setToolsButtonVisible(false);
