import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserChildrenService } from './children.service'
import { CreateChildDto } from './dto/create-child.dto'
import { UpdateChildDto } from './dto/update-child.dto'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { Roles } from '../../core/auth/decorators/roles.decorator'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { UpdateChildInterestsDto, UpdateChildSkillsDto } from './dto/child-interests-skills.dto'

@ApiTags('User Children')
@ApiBearerAuth()
@Controller('user/children')
@UseGuards(RolesOrPermissionsGuard)
@Roles('Parent')
export class UserChildrenController {
  constructor(private readonly childrenService: UserChildrenService) {}

  @Post()
  @ApiOperation({
    summary: 'Add a new child',
    description: 'Add a new child to your parent profile',
  })
  async create(@CurrentUser() user: any, @Body() createChildDto: CreateChildDto) {
    const child = await this.childrenService.create(user.id, createChildDto)
    return ResponseUtil.success(child)
  }

  @Get()
  @ApiOperation({
    summary: 'Get all your children',
    description: 'Retrieve all children associated with your parent profile',
  })
  async findAll(@CurrentUser() user: any) {
    const children = await this.childrenService.findAll(user.id)
    return ResponseUtil.success(children)
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a child by ID',
    description: 'Retrieve a specific child',
  })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const child = await this.childrenService.findOne(user.id, id)
    return ResponseUtil.success(child)
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a child',
    description: 'Update child information (any section)',
  })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateChildDto: UpdateChildDto
  ) {
    const child = await this.childrenService.update(user.id, id, updateChildDto)
    return ResponseUtil.success(child)
  }

  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Archive a child',
    description: 'Soft delete a child (can be restored later)',
  })
  async archive(@CurrentUser() user: any, @Param('id') id: string) {
    const child = await this.childrenService.archive(user.id, id)
    return ResponseUtil.success(child)
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a child',
    description: 'Permanently remove a child from your profile',
  })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.childrenService.remove(user.id, id)
    return ResponseUtil.success(result)
  }

  // ============================================
  // Interests & Skills
  // ============================================

  @Get(':id/interests')
  @ApiOperation({
    summary: 'Get child interests',
    description:
      'Retrieve catalogue-backed interests (categories + specific activities) for a child',
  })
  async getInterests(@CurrentUser() user: any, @Param('id') id: string) {
    const items = await this.childrenService.getInterests(user.id, id)
    return ResponseUtil.success(items)
  }

  @Patch(':id/interests')
  @ApiOperation({
    summary: 'Update child interests',
    description:
      'Replace all interests for a child. Send the complete array of categories and specific activities.',
  })
  async updateInterests(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateChildInterestsDto
  ) {
    const items = await this.childrenService.updateInterests(user.id, id, dto)
    return ResponseUtil.success(items)
  }

  @Get(':id/skills')
  @ApiOperation({
    summary: 'Get child skills',
    description: 'Retrieve catalogue-backed skills (activities with levels) for a child',
  })
  async getSkills(@CurrentUser() user: any, @Param('id') id: string) {
    const items = await this.childrenService.getSkills(user.id, id)
    return ResponseUtil.success(items)
  }

  @Patch(':id/skills')
  @ApiOperation({
    summary: 'Update child skills',
    description:
      'Replace all skills for a child. Send the complete array of activities and level values.',
  })
  async updateSkills(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateChildSkillsDto
  ) {
    const items = await this.childrenService.updateSkills(user.id, id, dto)
    return ResponseUtil.success(items)
  }
}
