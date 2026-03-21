import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
import { Readable } from 'stream';

interface CloudinaryDestroyResult {
  result: string;
}

@Injectable()
export class UploadsService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(
    file: Express.Multer.File,
  ): Promise<{ url: string; publicId: string }> {
    if (!file?.buffer) {
      throw new InternalServerErrorException(
        'El archivo llegó sin buffer. Verifica Multer memoryStorage().',
      );
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'uploads',
          resource_type: 'image',
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            reject(
              new InternalServerErrorException(
                error.message || 'Error al subir el archivo a Cloudinary',
              ),
            );
            return;
          }

          if (!result) {
            reject(
              new InternalServerErrorException(
                'Subida fallida: no se obtuvo un resultado',
              ),
            );
            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      const readableStream = new Readable();
      readableStream.push(file.buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<{ message: string }> {
    try {
      const result: unknown = await cloudinary.uploader.destroy(publicId);

      if (!this.isCloudinaryDestroyResult(result) || result.result !== 'ok') {
        throw new InternalServerErrorException(
          'No se pudo eliminar el archivo',
        );
      }

      return { message: 'Archivo eliminado correctamente' };
    } catch {
      throw new InternalServerErrorException(
        'Error al eliminar el archivo en Cloudinary',
      );
    }
  }

  private isCloudinaryDestroyResult(
    value: unknown,
  ): value is CloudinaryDestroyResult {
    return (
      typeof value === 'object' &&
      value !== null &&
      'result' in value &&
      typeof value.result === 'string'
    );
  }
}
