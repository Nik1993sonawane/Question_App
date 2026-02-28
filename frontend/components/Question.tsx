import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Voice from '@react-native-voice/voice';
import axios from 'axios';

const BASE_URL = 'http://192.168.1.3:5000';

interface QA {
  QUESTION: string;
  ANSWER_SUMMARY: string;
}

interface QuestionProps {
  onSpeechEnd: (text: string) => void;
}

const Question: React.FC<QuestionProps> = ({ onSpeechEnd }) => {
  const [question, setQuestion] = useState('');
  const [generatedQA, setGeneratedQA] = useState<QA[]>([]);
  const [loading, setLoading] = useState(false);
  const [latestTopic, setLatestTopic] = useState('');
  const [listening, setListening] = useState(false);
  const [resultText, setResultText] = useState('');

  // Request permission on Android
  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs access to your microphone to recognize your speech.',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        Alert.alert('Permission Error', 'Failed to request permission: ' + (err instanceof Error ? err.message : String(err)));
        return false;
      }
    }
    return true; // iOS or others: no explicit permission needed here
  };

  // Start voice recognition
  const startListening = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Cannot start voice recognition without microphone permission.');
      return;
    }

    try {
      setResultText('');
      await Voice.start('en-US');
      setListening(true);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      Alert.alert('Voice Start Error', 'Could not start voice recognition: ' + errorMsg);
    }
  };

  // Stop voice recognition
  const stopListening = async () => {
    try {
      await Voice.stop();
      setListening(false);
    } catch {
      // ignore
    }
  };

  // Voice event handlers with proper error type checks
  useEffect(() => {
    // onSpeechResults event handler
    const onSpeechResults = (e: any) => {
      const text = e.value && e.value.length > 0 ? e.value[0] : '';
      setResultText(text);
    };

    // onSpeechEnd event handler
    const onSpeechEndHandler = () => {
      setListening(false);
      if (resultText.trim().length > 0) {
        onSpeechEnd(resultText);
      }
    };

    // onSpeechError event handler with safe type access
    const onSpeechError = (e: any) => {
      const message = e?.error?.message || 'Unknown speech recognition error';
      Alert.alert('Speech Recognition Error', message);
      setListening(false);
    };

    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechEnd = onSpeechEndHandler;
    Voice.onSpeechError = onSpeechError;

    return () => {
      Voice.destroy().then(() => Voice.removeAllListeners());
    };
  }, [resultText, onSpeechEnd]); // include onSpeechEnd because it's a prop, but it may cause reruns if not stable

  // Polling generated questions and latest topic every 5 seconds
  useEffect(() => {
    fetchGeneratedQuestions();
    fetchLatestTopic();

    const interval = setInterval(() => {
      fetchGeneratedQuestions();
      fetchLatestTopic();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Fetch functions
  const fetchGeneratedQuestions = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/getQuestions`);
      if (response.data) setGeneratedQA(response.data);
    } catch {
      Alert.alert('❌ Error', 'Error fetching questions. Please try again.');
    }
  };

  const fetchLatestTopic = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/getLatestTopic`);
      setLatestTopic(response.data.topic || '');
    } catch {
      setLatestTopic('❌ Error fetching topic');
    }
  };

  // Submit handler to generate Q&A
  const handleSubmit = async () => {
    if (!question.trim()) {
      Alert.alert('❌ Input Error', 'Topic is required!');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${BASE_URL}/api/generateQA`, { topic: question });
      if (response.data && response.data.data.length > 0) {
        setGeneratedQA((prev) => [response.data.data[0], ...prev]);
        fetchLatestTopic();
        setQuestion('');
      }
    } catch {
      Alert.alert('❌ Error', 'Error generating Q&A. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#990000', '#cc0000', '#ff6666', '#ff3333', '#ff0000', '#cc0000', '#990000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Question and Answer Generator</Text>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Feather name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            placeholder="Search Topic Name....."
            placeholderTextColor="#888"
            style={styles.searchInput}
            value={''} // placeholder for search state if implemented
            onChangeText={() => {}} // placeholder handler
          />
        </View>

        <TouchableOpacity style={styles.buttonWrapper} onPress={() => Alert.alert('Download coming soon!')}>
          <LinearGradient
            colors={['#990000', '#cc0000', '#ff6666', '#ff3333', '#ff0000', '#cc0000', '#990000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.downloadButton}
          >
            <Feather name="download" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Topic Input */}
      <View style={styles.box}>
        <View style={styles.headerTexts}>
          <Text style={styles.title}>Generate Question and Answer</Text>
          <Text style={styles.subtitle}>Ask the Topic Name</Text>
        </View>

        <View style={styles.transparentRow}>
          <View style={styles.transparentInputWrapper}>
            <TextInput
              placeholder="Enter Topic Name"
              placeholderTextColor="#888"
              style={styles.transparentInput}
              value={question}
              onChangeText={setQuestion}
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity onPress={handleSubmit} disabled={loading}>
              <LinearGradient
                colors={['#990000', '#cc0000', '#ff6666', '#ff3333', '#ff0000', '#cc0000', '#990000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="arrow-up-circle" size={24} color="#fff" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.voiceButton}
            onPress={listening ? stopListening : startListening}
            disabled={loading}
          >
            <LinearGradient
              colors={['#990000', '#cc0000', '#ff6666', '#ff3333', '#ff0000', '#cc0000', '#990000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.voiceGradient}
            >
              <Feather name={listening ? 'mic-off' : 'mic'} size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Generated Q&A */}
      <View style={styles.qaBox}>
        <Text style={styles.boxTitle}>Generated Questions and Answers:-</Text>
        <View style={styles.topicNameWrapper}>
          <Text style={styles.topicNameLabel}>Topic Name:- </Text>
          <LinearGradient
            colors={['#990000', '#cc0000', '#ff6666', '#ff3333', '#ff0000', '#cc0000', '#990000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topicBadge}
          >
            <Text style={styles.topicText}>{latestTopic || 'No topic available'}</Text>
          </LinearGradient>
        </View>

        <View style={styles.hr} />

        {generatedQA.length > 0 ? (
          <FlatList
            data={generatedQA}
            keyExtractor={(_, index) => index.toString()}
            style={styles.qaList}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item, index }) => (
              <View style={styles.qaItem}>
                <Text style={styles.qaText}>
                  <Text style={styles.qaStrong}>Question {index + 1}:</Text> {item.QUESTION}
                </Text>
                <Text style={styles.qaText}>
                  <Text style={styles.qaStrong}>Answer:</Text> {item.ANSWER_SUMMARY}
                </Text>
                <View style={styles.hr} />
              </View>
            )}
          />
        ) : (
          <Text style={styles.noQaText}>No generated Q&A yet</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f6f6f6', 
    paddingTop: 50 
  },
  header: { 
    paddingVertical: 15, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 20, 
    letterSpacing: 1, 
    fontWeight: 'bold', 
    textAlign: 'center' 
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginVertical: 10,
    marginTop: 20,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#000',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  searchIcon: { 
    marginRight: 8 
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#000',
  },
  buttonWrapper: { 
    marginLeft: 10 
  },
  downloadButton: {
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    marginHorizontal: 15,
    padding: 10,
    maxHeight: 300,
    elevation: 2,
    borderRadius: 10,
    marginTop: 10
  },
  headerTexts: {
    marginBottom: 10,
    marginTop: 10
  },
  title: { 
    fontWeight: 'bold', 
    fontSize: 20,
    textAlign: 'center', 
    color: '#cc0000' 
  },
  subtitle: { 
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 15, 
    color: '#666'
  },
  transparentRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  transparentInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    backgroundColor: 'transparent',
    borderRadius: 50,
    paddingVertical: 1,
    paddingHorizontal: 15,
    marginBottom: 20,
    alignItems: 'center',
    marginLeft: 10
  },
  transparentInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#000'
  },
  gradientButton: {
    padding: 7,
    marginLeft: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  voiceButton: {
    marginLeft: 10,
    marginRight: 10,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 20
  },
  voiceGradient: {
    padding: 10,
    borderRadius: 30,
  },
  qaBox: {
    marginHorizontal: 15,
    marginBottom: 70,
    marginTop: 20,
    padding: 10,
    maxHeight: 300,
    elevation: 2,
    borderRadius: 10
  },
  qaList: {
    maxHeight: 280,
  },
  boxTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#cc0000',
    marginTop: 10,
    marginLeft: 20,
    marginRight: 20
  },
  topicNameWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 8 
  },
  topicNameLabel: { 
    fontSize: 14, 
    fontWeight: '700',
    color: '#000',
    marginLeft: 70 
  },
  topicBadge: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 5,
  },
  topicText: { 
    color: '#fff', 
    fontSize: 15,
    fontWeight: 'bold' 
  },
  hr: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 10,
  },
  qaItem: { 
    marginBottom: 10 
  },
  qaText: {
    backgroundColor: '#c0bbbb',
    padding: 14,
    margin: 8,
    borderRadius: 8,
    fontSize: 15,
    marginBottom: 10,
    color: '#333',
    borderLeftColor: '#ff0000',
    borderLeftWidth: 4,
  },
  qaStrong: {
    fontWeight: 'bold',
    color: '#cc0000',
  },
  noQaText: { 
    textAlign: 'center', 
    marginTop: 20, 
    color: '#666' 
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default Question;
