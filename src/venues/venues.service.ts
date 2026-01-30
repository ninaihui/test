import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@Injectable()
export class VenuesService {
  constructor(private prisma: PrismaService) {}

  async create(createVenueDto: CreateVenueDto) {
    return this.prisma.venue.create({
      data: {
        name: createVenueDto.name,
        address: createVenueDto.address,
      },
    });
  }

  async findAll() {
    return this.prisma.venue.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
    });
    if (!venue) {
      throw new NotFoundException('场地不存在');
    }
    return venue;
  }

  async update(id: string, updateVenueDto: UpdateVenueDto) {
    await this.findOne(id);
    return this.prisma.venue.update({
      where: { id },
      data: updateVenueDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.venue.delete({
      where: { id },
    });
    return { message: '场地已删除' };
  }
}
