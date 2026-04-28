import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { validateBondInput } from './bond.validation';
import type { AddBondInput } from './dto/add-bond.input';

@Injectable()
export class BondsService {
  private readonly logger = new Logger(BondsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async addBond(input: AddBondInput) {
    const valid = validateBondInput(input);
    try {
      const bond = await this.prisma.bond.create({
        data: {
          isin: valid.isin,
          maturityDate: valid.maturityDate,
          nominal: valid.nominal,
          couponRate: valid.couponRate,
          couponFrequency: valid.couponFrequency,
          type: valid.type,
        },
      });
      this.logger.log(`Bond ${bond.isin} registered`);
      return bond;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Облігація ${valid.isin} вже існує`);
      }
      throw error;
    }
  }

  async editBond(input: AddBondInput) {
    const valid = validateBondInput(input);
    try {
      const bond = await this.prisma.bond.update({
        where: { isin: valid.isin },
        data: {
          maturityDate: valid.maturityDate,
          nominal: valid.nominal,
          couponRate: valid.couponRate,
          couponFrequency: valid.couponFrequency,
          type: valid.type,
        },
      });
      this.logger.log(`Bond ${bond.isin} updated`);
      return bond;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Облігацію ${valid.isin} ще не додано`);
      }
      throw error;
    }
  }

  async getByIsin(isin: string) {
    const bond = await this.prisma.bond.findUnique({ where: { isin } });
    if (!bond) {
      throw new NotFoundException(`Облігацію ${isin} ще не додано`);
    }
    return bond;
  }

  async listBonds() {
    return this.prisma.bond.findMany({
      orderBy: [{ maturityDate: 'asc' }, { isin: 'asc' }],
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });
  }
}
