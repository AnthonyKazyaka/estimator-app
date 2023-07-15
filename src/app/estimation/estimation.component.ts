import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Configuration, OpenAIApi } from 'openai';
import { ChatCompletionRequestMessage, CreateChatCompletionResponse } from 'openai/dist/api';
import { environment } from 'src/environment';
import { Plan } from '../types/Plan';
import { Service } from '../types/Service';

declare var webkitSpeechRecognition: any;

const SYSTEM_ROLE = "system";
const USER_ROLE = "user";

@Component({
  selector: 'app-estimation',
  templateUrl: './estimation.component.html',
  styleUrls: ['./estimation.component.css']
})
export class EstimationComponent {
  public rawResponse: string = '';
  fileName: string = '';
  conversation = "I need a new light fixture installed in my living room. It's a standard ceiling fixture. Secondly, there's a leaky faucet in my bathroom that needs to be repaired. It's wasting water and needs fixing as soon as possible. Thirdly, there's a broken step on my front porch that needs to be repaired. It's becoming unsafe. Lastly, I need help with painting the master bedroom and the kitchen. I already have the paint. Oh and actually one more thing, we have a pair of TVs we need mounted.";
  plans: Plan[] = [];
  imageURL: any;
  isRecording: boolean = false;
  recognition: any;
  profession: string = '';
  professionForm!: FormGroup;
  serviceForm!: FormGroup;
  services: Service[] = [
    {
      "name": "Furniture Assembly",
      "price": 50
    },
    {
      "name": "TV Mounting",
      "price": 75
    },
    {
      "name": "Light Fixture Installation",
      "price": 60
    },
    {
      "name": "Cabinet Installation",
      "price": 100
    },
    {
      "name": "Shelving Installation",
      "price": 80
    },
    {
      "name": "Door Repair/Installation",
      "price": 70
    },
    {
      "name": "Window Repair/Installation",
      "price": 90
    },
    {
      "name": "Drywall Repair",
      "price": 60
    },
    {
      "name": "Painting (per room)",
      "price": 150
    },
    {
      "name": "Gutter Cleaning",
      "price": 80
    }
  ];

  constructor(private formBuilder: FormBuilder) {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new webkitSpeechRecognition();
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }

    this.serviceForm = this.formBuilder.group({
      serviceName: ['', Validators.required],
      servicePrice: ['', Validators.required],
    });

    this.professionForm = this.formBuilder.group({
      profession: ['', Validators.required],
    });
  }

  onProfessionSubmit(): void {
    //if (this.professionForm.valid) {
      this.profession = this.professionForm.value.profession;
      this.professionForm.reset();
    //}
  }

  onSubmit(): void {
    if (this.serviceForm.valid) {
      this.services.push({
        name: this.serviceForm.value.serviceName,
        price: this.serviceForm.value.servicePrice,
      });
      this.serviceForm.reset();
    }
  }

  startRecording(): void {
    if (this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
    } else {
      this.recognition.onresult = (event: any) => {
        let transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');

        this.conversation = transcript;
      };

      this.recognition.onerror = (event: any) => {
        console.error('Error occurred in recognition: ' + event.error);
      };

      this.recognition.onend = () => {
        this.isRecording = false;
      };

      this.recognition.start();
      this.isRecording = true;
    }
  }  

  onFileSelected(event: any): void {
    const fileInput = event.target as HTMLInputElement;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      return;
    }
    const file: File = fileInput.files[0];
    
    // Store the selected file name to display in the text field
    this.fileName = file.name;
    
    let reader = new FileReader();
    reader.onload = (e: any) => {
      this.imageURL = e.target.result;
    }
    reader.readAsDataURL(file);
  }  

  async processConversation(): Promise<void> {
    if (!this.profession) {
      alert('Please set your profession before processing the conversation!');
      return;
    }

    // Initialize OpenAI API with your key
    const configuration = new Configuration({
      organization: "org-cAscKDDTB5jALFIUcQdVHfoq",
      apiKey: environment.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);
  
    // Define the system message and user message using the conversation
    const systemMessage = this.getSystemMessage();
    const servicesMessage = this.getServicesMessage();
    const userMessage = this.getUserMessage();
  
    // Send a chat completion request
    const chatCompletionResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [systemMessage, servicesMessage, userMessage],
    });
  
    // Extract and save the plans
    this.rawResponse = chatCompletionResponse?.data?.choices[0]?.message?.content ?? '';
    const assistantMessage = this.getAssistantMessage(chatCompletionResponse.data);
    this.updatePlansFromAssistantMessage(assistantMessage);
  
    // Check if a photo is required
    const photoRequired = this.isPhotoRequiredForEstimate(chatCompletionResponse.data);
    if (photoRequired) {
      alert('Consider attaching a photo for a more accurate estimate.');
    }
  }
  

  getSystemMessage(): ChatCompletionRequestMessage {
    return { 
      role: SYSTEM_ROLE, 
      content: `You are an experienced ${this.profession} who can analyze job details and provide a breakdown for potential plans of action. Your responses MUST be formatted as a JSON array of Plan JSON objects, each with properties: 'name' (string), 'cost' (number), 'details' (string), 'timeline' (string), 'resources' (string[]), and 'photoRequiredForEstimate' (bool).` 
    };
  }

  getServicesMessage(): ChatCompletionRequestMessage {
    return { 
      role: SYSTEM_ROLE, 
      content: "These are the services offered, along with their price: " + JSON.stringify(this.services) + ". Remember to output the plans in a JSON array format." 
    };
  }

  getUserMessage(): ChatCompletionRequestMessage {
    return { 
      role: USER_ROLE, 
      content: this.conversation 
    };
  }

  getAssistantMessage(chatCompletionResponse: CreateChatCompletionResponse) {
    return chatCompletionResponse.choices[0].message;
  }

  updatePlansFromAssistantMessage(assistantMessage: any) {
    try {
      // Try to parse the message as a JSON array of Plans
      const plans: Plan[] = JSON.parse(assistantMessage.content);
      this.plans.push(...plans);
    } catch (error) {
      // If parsing failed, the message was probably not a JSON array of Plans
      console.error('Could not parse message as JSON array of Plans:', assistantMessage);
    }
  }

  isPhotoRequiredForEstimate(chatCompletionResponse: CreateChatCompletionResponse): boolean {
    return chatCompletionResponse?.choices[0]?.message?.content?.includes('"photoRequiredForEstimate": true') === true;
  }
}
