# Gemini AI Python API Reference (LLM + TTS)

This document describes how to use the Gemini Python wrapper in this project. Treat these functions as the public API. Do not rewrite or bypass them unless explicitly requested.

---

# Project Structure

```
project/
│
├── ai.py
├── tts.py
├── main.py
├── .env
└── requirements.txt
```

---

# AI Module

Import:

```python
from ai import AI
```

Create an instance:

```python
bot = AI()
```

The AI object stores conversation history automatically.

---

## ask()

Signature

```python
answer = bot.ask(prompt: str)
```

### Parameters

* prompt (str)

  * The message to send to Gemini.

### Returns

* str

  * The AI's response.

### Example

```python
answer = bot.ask("Hello")
print(answer)
```

---

Conversation history is automatically preserved.

Example

```python
bot.ask("My name is Alex.")

bot.ask("What is my name?")
```

The model remembers previous messages because history is stored internally.

Never manually edit `bot.history` unless instructed.

---

# TTS Module

Import

```python
from tts import speak
```

---

## speak()

Signature

```python
filename = speak(text)
```

### Parameters

* text (str)

The text to convert into speech.

Optional

```python
filename = speak(
    "Hello world",
    output="hello.wav"
)
```

### Returns

Returns the filename of the generated WAV file.

---

Example

```python
answer = bot.ask("Tell me a joke")

file = speak(answer)

print(file)
```

Produces

```
speech.wav
```

unless another filename is supplied.

---

# Supported Voice

Current default voice

```
Kore
```

This can be changed inside `tts.py`.

---

# Typical Usage

```python
from ai import AI
from tts import speak

bot = AI()

response = bot.ask("Hello!")

print(response)

speak(response)
```

---

# Expected Behavior

When generating Python code:

Use

```python
bot.ask(...)
```

Never call the Gemini SDK directly.

For speech:

Use

```python
speak(text)
```

Never manually create audio requests unless asked.

---

# Rules for AI Code Generation

Whenever writing code for this project:

1. Always import from `ai.py` instead of using `google.genai`.

2. Never instantiate another Gemini client.

3. Assume one global AI instance exists unless told otherwise.

4. Always preserve conversation history.

5. Do not modify internal history directly.

6. Use `speak()` whenever audio output is requested.

7. Assume the API key is already configured.

8. Never ask the user for an API key.

9. Return normal Python strings.

10. Do not save extra files unless requested.

---

# Examples

Chat

```python
response = bot.ask("Explain recursion")
```

Speech

```python
speak(response)
```

Loop

```python
while True:
    text = input("> ")

    if text == "exit":
        break

    response = bot.ask(text)

    print(response)

    speak(response)
```

---

# AI Coding Guidelines

If extending this project:

* Reuse existing modules.
* Prefer helper functions over duplicated code.
* Keep AI logic inside `ai.py`.
* Keep audio logic inside `tts.py`.
* Keep UI code inside `main.py`.
* Do not duplicate Gemini client initialization.
* Do not hardcode API keys.
* Write clean, type-hinted Python where practical.
* Preserve backward compatibility with the existing API.

---

# Public API Summary

```python
from ai import AI
from tts import speak

bot = AI()

response = bot.ask("Hello")

speak(response)
```

Only rely on the interfaces documented above unless new functionality is explicitly added to the project.
