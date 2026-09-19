import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImageProcessorService } from './image-processor.service';
import {
  IMAGE_PROCESSING_CONFIG,
  loadImageProcessingConfig,
} from './images.config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: IMAGE_PROCESSING_CONFIG,
      inject: [ConfigService],
      useFactory: loadImageProcessingConfig,
    },
    ImageProcessorService,
  ],
  exports: [ImageProcessorService],
})
export class ImagesModule {}
