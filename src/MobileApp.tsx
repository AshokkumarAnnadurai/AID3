import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

// Default to the Mac host IP on the local Wi-Fi network
const DEFAULT_URL = 'http://192.168.1.189:3000';

export default function MobileApp() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const handleApplyUrl = () => {
    let formatted = inputUrl.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `http://${formatted}`;
    }
    setServerUrl(formatted);
    setShowConfig(false);
    setHasError(false);
    setLoading(true);
  };

  const handleReload = () => {
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Top Header Controls */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.statusDot} />
          <Text style={styles.headerTitle}>AID3 Mobile</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleReload}
            activeOpacity={0.7}
          >
            <Text style={styles.headerButtonText}>↻ Reload</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, styles.configButton]}
            onPress={() => setShowConfig(!showConfig)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerButtonText}>⚙ Server IP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Server IP Config Panel */}
      {showConfig && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.configPanel}
        >
          <Text style={styles.configLabel}>Local Vite Server URL:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="http://192.168.1.xxx:3000"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApplyUrl}
            >
              <Text style={styles.applyButtonText}>Connect</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.configHint}>
            Ensure your Mac and phone are on the same Wi-Fi, and run `npm run dev` on Mac.
          </Text>
        </KeyboardAvoidingView>
      )}

      {/* WebView Container */}
      <View style={styles.webviewWrapper}>
        <WebView
          ref={webViewRef}
          source={{ uri: serverUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setHasError(true);
          }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          cacheEnabled={true}
          mixedContentMode="always"
        />

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator size="large" color="#F97316" />
            <Text style={styles.loadingText}>Connecting to AID3 ({serverUrl})...</Text>
          </View>
        )}

        {/* Connection Error Screen */}
        {hasError && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Cannot Connect to Server</Text>
            <Text style={styles.errorSubtitle}>Target: {serverUrl}</Text>
            <View style={styles.instructionsBox}>
              <Text style={styles.instructionText}>
                1. Make sure your Mac has started the server:
              </Text>
              <Text style={styles.codeText}>npm run dev</Text>
              <Text style={styles.instructionText}>
                2. Verify both your phone and Mac are connected to the same Wi-Fi.
              </Text>
              <Text style={styles.instructionText}>
                3. If your Mac IP changed, tap "⚙ Server IP" above to update it.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleReload}
            >
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0,
    paddingBottom: Platform.OS === 'android' ? 10 : 0,
  },
  header: {
    height: 48,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  headerButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  configButton: {
    backgroundColor: '#334155',
  },
  headerButtonText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  configPanel: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  configLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#020617',
    color: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  applyButton: {
    backgroundColor: '#F97316',
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  configHint: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 6,
  },
  webviewWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#020617',
  },
  webview: {
    flex: 1,
    backgroundColor: '#020617',
  },
  centerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 13,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  errorSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  instructionsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 14,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  instructionText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    marginVertical: 4,
  },
  codeText: {
    backgroundColor: '#020617',
    color: '#F97316',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
  retryButton: {
    backgroundColor: '#F97316',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
