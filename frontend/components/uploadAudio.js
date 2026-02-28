// uploadAudio.js
import axios from 'axios';

const BASE_URL = 'http://192.168.1.3:5000';

export const uploadAudio = async (uri) => {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: 'recording.wav',
    type: 'audio/wav',
  });

  try {
    const response = await axios.post(`${BASE_URL}/uploadAudio`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('❌ Upload Error:', error);
    return null;
  }
};
