import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserReviewsService } from './reviews.service'
import { CreateReviewDto } from './dto/create-review.dto'
import { UpdateReviewDto } from './dto/update-review.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'

@ApiTags('User Reviews')
@ApiBearerAuth()
@Controller('user/reviews')
@UseGuards(RolesOrPermissionsGuard)
@Roles('Parent')
export class UserReviewsController {
  constructor(private readonly reviewsService: UserReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all reviews (published + pending moderation)' })
  async findAll(@CurrentUser() user: any) {
    const data = await this.reviewsService.findAll(user.id)
    return ResponseUtil.success(data)
  }

  @Get('eligible')
  @ApiOperation({ summary: 'Get camps eligible for review (attended + all published)' })
  async findEligible(@CurrentUser() user: any) {
    const data = await this.reviewsService.findEligible(user.id)
    return ResponseUtil.success(data)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single review by id (must belong to current parent)' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const review = await this.reviewsService.findOne(user.id, id)
    return ResponseUtil.success({ review })
  }

  @Post()
  @ApiOperation({ summary: 'Create a review (draft or submit for moderation)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateReviewDto) {
    const review = await this.reviewsService.create(user.id, dto)
    return ResponseUtil.success({ review })
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a review' })
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateReviewDto) {
    const review = await this.reviewsService.update(user.id, id, dto)
    return ResponseUtil.success({ review })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a draft review' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.reviewsService.remove(user.id, id)
    return ResponseUtil.success(result)
  }
}
