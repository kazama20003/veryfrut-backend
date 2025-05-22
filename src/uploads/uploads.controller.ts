import {
  Controller,
  Post,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express'; // ✅ Falta esto
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {} // ✅ uso correcto

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No se ha recibido ningún archivo');
    }
    return await this.uploadsService.uploadImage(file); // ✅ uso correcto del servicio
  }

  @Delete(':publicId')
  async deleteFile(@Param('publicId') publicId: string) {
    return this.uploadsService.deleteFile(publicId); // ✅ uso correcto del servicio
  }
}
