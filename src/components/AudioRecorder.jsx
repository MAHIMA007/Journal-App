import React, { useState, useRef } from 'react';
import './AudioRecorder.css';

const AudioRecorder = ({ onTranscriptionComplete }) => {
  const [isDictating, setIsDictating] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');
  const [editingText, setEditingText] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const recognitionRef = useRef(null);
  const fullTranscriptRef = useRef('');

  const startDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech Recognition not supported in your browser. Try Chrome, Edge, or Safari.');
      return;
    }

    setError('');
    setTranscribedText('');
    setInterimText('');
    fullTranscriptRef.current = '';

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsDictating(true);
      console.log('Listening...');
    };

    recognition.onresult = (event) => {
      let interim = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          fullTranscriptRef.current += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      
      setTranscribedText(fullTranscriptRef.current);
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'network') {
        setError('Network error. Check your internet connection.');
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.');
      } else {
        setError(`Error: ${event.error}`);
      }
      setIsDictating(false);
    };

    recognition.onend = () => {
      setIsDictating(false);
      setInterimText('');
      
      if (fullTranscriptRef.current.trim()) {
        const finalText = fullTranscriptRef.current.trim();
        setTranscribedText(finalText);
        setEditingText(finalText);
        setShowDraft(true);
      } else if (!error) {
        setError('No speech was captured. Please try again.');
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setError('Failed to start microphone. Please check permissions.');
      setIsDictating(false);
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current && isDictating) {
      recognitionRef.current.stop();
    }
  };

  const saveDraft = () => {
    if (editingText.trim()) {
      onTranscriptionComplete({
        title: 'Voice Note',
        content: editingText.trim(),
        tags: ['voice-recording']
      });
      resetRecorder();
    }
  };

  const resetRecorder = () => {
    setTranscribedText('');
    setInterimText('');
    setEditingText('');
    setShowDraft(false);
    setError('');
    fullTranscriptRef.current = '';
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
  };

  const cancelDictation = () => {
    resetRecorder();
  };

  return (
    <div className="audio-recorder-container">
      <h3>� Voice Dictation</h3>
      
      {error && <div className="error-message">{error}</div>}

      {!showDraft ? (
        <div className="dictation-controls">
          {!isDictating ? (
            <>
              <button
                className="dictate-btn"
                onClick={startDictation}
              >
                🎤 Start Dictating
              </button>
              <p className="instruction">
                Click the microphone and speak naturally. Transcription happens in real-time.
              </p>
            </>
          ) : (
            <div className="dictation-active">
              <div className="listening-indicator">
                <span className="pulse-ring"></span>
                <span className="pulse-ring pulse-ring-2"></span>
                <span className="pulse-ring pulse-ring-3"></span>
              </div>
              
              <div className="transcription-display">
                <div className="final-text">
                  {transcribedText || 'Listening...'}
                </div>
                {interimText && (
                  <div className="interim-text">
                    {interimText}
                  </div>
                )}
              </div>

              <div className="dictation-buttons">
                <button className="btn-secondary" onClick={stopDictation}>
                  ⏹️ Done Speaking
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {showDraft && (
        <div className="transcription-draft">
          <h4>Review & Edit</h4>
          <textarea
            className="draft-textarea"
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            placeholder="Edit your transcription here..."
          />
          <div className="draft-actions">
            <button className="btn-secondary" onClick={cancelDictation}>
              ← Record Again
            </button>
            <button className="btn-primary" onClick={saveDraft}>
              💾 Save as Entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
