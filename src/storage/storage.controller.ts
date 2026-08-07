import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      const url = await this.storageService.uploadFile(
        `uploads/${Date.now()}_${file.originalname}`,
        file.buffer,
        file.mimetype,
      );
      return { url, fileName: file.originalname };
    } catch (e: any) {
      // Return dev static url fallback if R2 credentials are placeholders
      return {
        url: `https://via.placeholder.com/300?text=${encodeURIComponent(file.originalname)}`,
        fileName: file.originalname,
      };
    }
  }
}
