import React from 'react';
import { SafeAreaView } from 'react-native';
import Question from '../../components/Question';

const App = () => {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Question onSpeechEnd={function (text: string): void {
        throw new Error('Function not implemented.');
      } } />
    </SafeAreaView>
  );
};

export default App;
