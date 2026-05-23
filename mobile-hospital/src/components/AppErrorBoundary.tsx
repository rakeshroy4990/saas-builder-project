import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getOrCreateTraceId, ingestSessionTelemetry } from '@/analytics/sessionTelemetry';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches render errors so a bad screen does not take down the whole app. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    void ingestSessionTelemetry({
      event_name: 'ui_render_error',
      flow: 'app',
      status: 'fail',
      reason_code: 'react_error_boundary',
      trace_id: getOrCreateTraceId()
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      const detail = this.state.error.message?.trim();
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>Please restart the app. If this continues, reinstall the latest APK.</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
          <Pressable style={styles.btn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc'
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8
  },
  body: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 12
  },
  detail: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 20
  },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0d9488',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8
  },
  btnText: {
    color: '#fff',
    fontWeight: '600'
  }
});
