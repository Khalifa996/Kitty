import { AppRegistry, Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';
import { brainTask } from './src/brain/task';

// The background brain: Android runs this when a bank alert arrives, a notification button is tapped,
// or a waiting payment has settled, even when Crest isn't open
if (Platform.OS === 'android') AppRegistry.registerHeadlessTask('CrestBrain', () => brainTask);

registerRootComponent(App);
